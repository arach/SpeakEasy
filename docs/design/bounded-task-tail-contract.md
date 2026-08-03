# Bounded task-tail contract

Status: implementation brief for Scout / `@openscout/agent-sessions`
Date: 2026-08-03

## Problem

Long-lived agent tasks accumulate append-only histories containing compaction
snapshots, reasoning records, screenshots, and raw tool output. The current
SpeakEasy task is roughly 194 MiB even though its useful conversational tail is
small. Consumers that need recent user/assistant messages should not reconstruct
or transport the entire history.

Scout should provide a reusable, harness-neutral task-tail primitive through
`@openscout/agent-sessions`. SpeakEasy will consume that primitive for recent
activity, observer context, and presentation. It must remain a local runtime
component, not a Scout broker hop in the canonical conversation.

## Proposed public contract

```ts
type TaskTailRole = "user" | "assistant";

interface TaskTailMessage {
  id: string;
  role: TaskTailRole;
  text: string;
  timestamp?: string;
  turnId?: string;
}

interface TaskTailInput {
  path: string;
  adapterType?: "codex" | "claude-code";
  expectedTaskId?: string;
  cursor?: string;
  maxMessages?: number; // default 20, hard maximum 100
  maxBytes?: number;    // default 256 KiB, hard maximum 2 MiB
}

interface TaskTailResult {
  adapterType: "codex" | "claude-code";
  taskId: string;
  messages: TaskTailMessage[];
  cursor: string;
  truncated: boolean;
  source: {
    path: string;
    identity: string;
    startOffset: number;
    endOffset: number;
  };
}

function readTaskTail(input: TaskTailInput): TaskTailResult;
```

Names may change to match package conventions, but the bounded behavior and
identity rules are normative.

## Semantics

1. With no cursor, read backward from the file tail until both requested limits
   are satisfied. Do not parse from byte zero.
2. With a cursor, read forward from the proven offset and return only newly
   completed messages, plus a replacement cursor.
3. The cursor is opaque, versioned, and binds adapter type, task identity,
   file identity, and byte offset. Reject rotation, truncation, task mismatch,
   or an invalid offset instead of guessing continuity.
4. Return normalized user and final assistant messages only. Exclude reasoning,
   compaction replacement history, raw tool output, image/base64 payloads,
   progress events, system/developer prompts, and duplicate event mirrors.
5. Apply `maxBytes` to normalized output as well as bounded source reads. A
   single oversized message is deterministically truncated and marked; it must
   not cause an unbounded allocation.
6. Ordering is chronological. IDs and turn IDs come from the source record when
   available; deterministic derived IDs are acceptable only when the adapter
   lacks one.
7. This API is read-only. It cannot submit, steer, resume, or create a task.

## Codex adapter

The first implementation should support Codex rollout JSONL:

- prove the task ID from `session_meta` and/or the known rollout filename;
- normalize `response_item/message` records for user and assistant roles;
- prefer the canonical final assistant message and deduplicate mirrored
  `event_msg/user_message` / `event_msg/agent_message` records;
- ignore `compacted` records entirely;
- ignore tool call inputs/outputs and reasoning;
- retain a correlatable `turn_id` when present in adjacent canonical records;
- operate correctly when the rollout is hundreds of MiB.

Codex history support should be added to the existing history surface rather
than creating a SpeakEasy-only parser. Claude Code should use the same public
contract once its adapter is wired.

## Ownership boundary

The tail reader does **not** prove that Codex Desktop currently owns a task.
SpeakEasy must first establish the exact Desktop-owner boundary and validate
the rollout path/identity. The tail reader then projects recent content from
that already-proven source.

The operator's dictation continues directly to the canonical Codex task. Scout
owns this reusable parsing/cursor pattern, not the conversation data plane.

## Acceptance criteria

- A synthetic 200 MiB Codex rollout returns the last 20 messages without
  reading or retaining the full file.
- Compaction snapshots and multi-megabyte tool outputs do not appear in output.
- Duplicate user/assistant mirrors are emitted once.
- Initial tail and forward-cursor modes are deterministic.
- File replacement, truncation, wrong task ID, corrupt cursor, and oversized
  limits fail closed with typed errors.
- Source files and returned message content are never written to broker state.
- Unit tests report the bounded source-byte budget so regressions are visible.
- Package exports and README/API documentation describe the contract.

## SpeakEasy integration after Scout delivery

1. Upgrade `@openscout/agent-sessions`.
2. Use `readTaskTail` for lane recent activity and observer/presenter context.
3. Keep the warm Desktop IPC channel for task ownership and turn dispatch.
4. Persist only the opaque tail cursor and small normalized presentation state.
5. Remove any remaining code path that asks a device or presenter to consume a
   full canonical snapshot.
