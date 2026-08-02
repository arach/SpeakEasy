# SpeakEasy conversation topology

## Decision

SpeakEasy is a remote input/output surface for one canonical Codex task. A
worker pad behaves like a keyboard, microphone, display, and speaker with lane
memory. It does not create a second conversation and it does not send the
operator's turn through the Scout broker.

Scout may define and implement the local role topology—potentially through
`agent-sessions` primitives—but those roles are runtime components, not Scout
peer identities. There is no `ask`, broker receipt, agent alias, or Scout
conversation between the operator and Codex.

## Ownership spheres

| Sphere | Owns | Must not own |
|---|---|---|
| Deck device | Capture, ASR finalization, lane selection, playback controls | Task history or task execution |
| Canonical Codex task | Full user transcript, reasoning, tools, final response | Device presentation policy |
| Observer | Read-only task state, completion events, progress-derived metadata | User-turn dispatch or canonical transcript mutation |
| Presenter / narrator | Redaction, compression, speech shaping, TTS queue | Task execution or authoritative answers |
| Orchestrator (optional) | Role lifecycle, cancellation, backpressure, correlations | Rewriting or rerouting operator turns |
| Scout framework | Contracts, topology helpers, lifecycle implementation, diagnostics | The canonical conversation data plane |

The roles are scoped by the canonical task id, not by a broker identity:

```text
TaskScope(codexTaskId)
  ├─ CanonicalTurnTransport  (write authority)
  ├─ TaskObserver            (read authority)
  ├─ Presenter               (derived-output authority)
  └─ Narrator                (audio-output authority)
```

## Loops

### 1. Interaction loop — lossless and direct

```text
microphone → ASR final → exact task-id check → Codex task owner
```

The ASR final is submitted verbatim as a native user turn. The transport must
return the same task id plus a correlatable turn id. If exact ownership cannot
be proven, the turn fails visibly. It never falls back to a fresh app-server
task, a Scout message, or a summary produced by another model.

### 2. Observation loop — read-only

```text
Codex task events → task-scoped cursor → normalized observations
```

The observer can derive state such as `working`, `needs_input`, `completed`,
recent tools, or the latest final response. Its cursor is durable and tied to
the exact task rollout identity. It cannot insert messages into the task.

### 3. Presentation loop — disposable derivation

```text
normalized observation → redact / compress / speech-shape → TTS
```

A cheap, fast model such as Luna may be used here. Its output is presentation,
not conversation history. The full canonical response remains visible in
Codex; the spoken form can omit code, paths, repetitive logs, or long detail.
Derived prompts and results live in a separate, hidden runtime store and may be
deleted without affecting the task.

### 4. Orchestration loop — control plane only

The optional orchestrator starts and stops observer/presenter components,
propagates cancellation, applies queue policy, and records correlations. It can
recommend actions but cannot dispatch a canonical user turn. This keeps a
future multi-role topology from becoming a hidden conversational hop.

## Minimal contracts

```ts
type CanonicalTurn = {
  taskId: string;
  transcript: string;
  source: 'speakeasy-deck';
  captureId: string;
};

type CanonicalReceipt = {
  taskId: string;        // must exactly equal CanonicalTurn.taskId
  turnId: string;
  delivery: 'started-turn' | 'steered-active-turn';
};

type TaskObservation = {
  taskId: string;
  turnId?: string;
  cursor: string;
  kind: 'working' | 'needs_input' | 'completed' | 'failed';
  payload: unknown;
};

type Presentation = {
  taskId: string;
  turnId?: string;
  text: string;
  provenance: 'canonical' | 'derived';
};
```

Every derived event retains `taskId` and, when available, `turnId`. Correlation
is explicit; roles do not infer identity from titles, snippets, or response
text.

## Hard invariants

1. One operator turn produces at most one canonical Codex user message.
2. Worker pads require an explicit task assignment.
3. The canonical route has no Scout broker hop and no model rewrite.
4. Observer and presenter state is per task and hidden from task history.
5. Derived output can be wrong or discarded without corrupting the task.
6. Stopping Scout, the observer, or the presenter cannot prevent direct turn
   submission; only loss of the exact Codex task owner can do that.
7. Every fallback is presentation-only. There is no fallback destination for a
   canonical user turn.

## What Scout can own

Scout can provide the reusable implementation package for `TaskScope`, role
registration, cancellation, event schemas, cursors, local tracing, and feature
flags. `agent-sessions` can host a hidden presenter or overview role in a
separate app-server instance. None of those components needs or receives a
Scout broker identity, and none appears as a peer in agent-to-agent messaging.

This makes the division precise: **Scout owns the topology pattern; Codex owns
the conversation; SpeakEasy owns the device experience.**
