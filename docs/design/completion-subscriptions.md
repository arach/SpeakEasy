# Completion subscriptions

Status: proposed implementation brief
Date: 2026-08-01

## Product idea

SpeakEasy should be able to narrate a Codex task when it finishes work even
when that work did not begin as a SpeakEasy dictation.

Today, narration is coupled to the active voice turn: SpeakEasy submits text to
one exact task, waits for that turn, and speaks its response. Completion mode
adds a separate, explicit subscription:

> Subscribe to an exact Codex task and hear its future completed turns on a
> chosen announcement channel.

This is not ambient task discovery and it does not create another conversation.
Codex Desktop remains the owner of the task and its transcript. SpeakEasy only
observes completions from the exact subscribed task and narrates them.

## Product boundary

Completion subscriptions are independent from interactive voice lanes.

- A **voice lane** answers “where should this dictation go?”
- A **completion subscription** answers “which task should I hear when it
  finishes?”
- An **announcement channel** answers “how should those completions be spoken?”

Selecting or changing the active lane must not silently change subscriptions.
Subscribing must not activate a lane, open the microphone, submit a prompt,
resume a task, or steer an active turn.

## Smallest useful flow

1. The user opens the exact-task browser and chooses a real Codex task.
2. The user enables **Announce completions** for that task.
3. The user chooses an announcement channel. The first release may provide one
   built-in channel named **Completions** with its own voice, playback speed,
   and mute state.
4. SpeakEasy establishes a read-only follower for the exact task and records a
   baseline. Existing history is not announced.
5. When a future Codex turn completes, SpeakEasy queues that final assistant
   response for narration exactly once.
6. The activity record shows the task, turn, detection time, playback state,
   and any failure. The user can replay or dismiss an item without changing the
   Codex task.
7. The user can mute the channel or remove the subscription at any time.

## First-release scope

The first vertical slice supports:

- one durable subscription to one exact Codex task
- one independent **Completions** announcement channel
- final assistant responses from newly completed turns
- exactly-once enqueueing per exact task ID and turn ID
- visible subscribed, watching, muted, unavailable, and failed states
- on, off, mute, unmute, replay, and dismiss controls
- restart recovery from a durable event cursor
- a compact activity record for detected and narrated completions
- the configured TTS provider and voice, with no silent provider fallback

After the vertical slice is proven, the same model may support multiple tasks,
project-level collections, channel-specific filters, quiet hours, or brief
summaries.

## Subscription identity and persistence

Task identity follows the existing exact-task rules. Title, project, branch,
and path are display metadata; the Codex task ID is the routing authority.

A durable record should be conceptually equivalent to:

```swift
struct CompletionSubscription: Codable, Equatable, Sendable {
    let task: ListeningTaskLock
    var channelID: String
    var isEnabled: Bool
    var lastObservedTurnID: String?
    var lastEnqueuedTurnID: String?
    var subscribedAt: Date
}
```

The persisted cursor must distinguish observation from enqueueing so a crash
cannot produce either a silent loss or duplicate speech. Write the enqueue
decision durably before handing an item to the playback queue.

No pre-subscription history should be spoken. On relaunch, SpeakEasy resumes
after the last durable cursor. If Codex cannot prove continuity, the
subscription becomes unavailable and requires revalidation rather than
guessing or replaying an unbounded backlog.

## Completion event contract

A narratable event must contain:

- exact Codex task ID
- exact Codex turn ID
- final assistant response text
- completion timestamp
- validated rollout or Desktop-owner provenance

The deduplication key is `(taskID, turnID)`. Text, title, recency, filesystem
path, and current window focus are not identity.

Only terminal turn completion is narratable in the first release. Intermediate
tool calls, progress messages, permission requests, and partial assistant text
remain visible in Codex but are not spoken as completions. Later versions may
add explicit event filters; they must not broaden the default silently.

## Codex boundary

Use the same fail-closed Desktop ownership boundary as the current voice loop.
Do not launch `codex app-server`, create a shadow task, scrape window titles,
write Codex storage, or infer completion from notification text.

The current `CodexThreadRouter` and bundled `codex-desktop-bridge.cjs` already
validate exact task ownership and correlate a submitted turn to its rollout.
Completion mode needs a read-only, long-lived observation path that can:

1. validate the exact subscribed task with its owning Desktop renderer,
2. establish a baseline without announcing history,
3. observe future exact turn IDs and terminal completion records,
4. emit a structured completion event, and
5. fail closed when ownership, protocol, rollout continuity, or task identity
   can no longer be proven.

The observer must not share `CodexThreadRouter.activeProcess`, because an
interactive submission and a background subscription can coexist. Give the
observer its own lifecycle and cancellation boundary.

## Announcement channel

The **Completions** channel is a playback policy, not a conversational lane.
It owns:

- provider, voice, narration cue, and playback speed
- mute state
- queue ordering for completion items
- interruption behavior
- replay history

Interactive responses should remain higher priority than background
completions. A completion detected while the user is recording or while an
interactive response is speaking should wait in the channel queue. It must not
open the microphone, interrupt a voice turn, or be dropped silently.

For the first release, queue oldest-first. Muting pauses future playback without
discarding the activity record. Removing a subscription stops observation but
does not delete the Codex task or its transcript.

## Speech projection

The full final assistant response remains in Codex. The first slice may use the
existing deterministic Markdown-to-speech projection before TTS. It should not
send response text through a hidden conversational agent.

If later responses are summarized for speech, summarization must be an optional
channel policy with these constraints:

- it receives response text, never Codex routing authority
- it cannot submit, resume, steer, or mutate a task
- its output affects narration only, never the Codex transcript
- failure falls back to deterministic projection

## UI proposal

Add subscription controls to the exact-task surface rather than to the
microphone control:

- **Announce completions** toggle on the selected task
- **Channel: Completions** picker or disclosure
- channel mute control in the menu bar player and Deck
- a small subscription badge on subscribed tasks
- activity rows such as “Hudson · turn completed · queued” and
  “Hudson · announced 2 minutes ago”

The UI must show quality data rather than performative signals: exact task
name, project/path, branch when available, last observed completion, queue
count, and concrete failure reason. Do not add pulsing live dots or fake
progress.

## Failure behavior

- Codex Desktop unavailable: keep the subscription configured, mark it
  unavailable, and retry only through a bounded reconnect policy.
- Task closed or ownership lost: stop observing and require successful exact-ID
  revalidation before announcing anything else.
- Protocol or rollout mismatch: fail closed; do not fall back to app-server or
  a different task.
- Duplicate completion: discard it by `(taskID, turnID)` and record the
  deduplication decision for diagnostics.
- TTS/provider failure: keep the completion in activity with a replay action;
  never silently switch providers.
- Playback busy: queue the completion behind interactive speech.
- App restart: restore the subscription and cursor, then revalidate before
  resuming observation.

## Acceptance criteria

The vertical slice is complete when all of the following are demonstrable:

1. Subscribe to one exact Codex task without making it the active voice lane.
2. Start a turn directly in Codex Desktop, without SpeakEasy dictation.
3. See SpeakEasy detect that exact turn's completion and narrate its final
   assistant response once.
4. Confirm the full response remains in the same Codex task and no shadow task
   or app-server was created.
5. Complete another turn while SpeakEasy is narrating an interactive response;
   the completion waits and then plays.
6. Restart SpeakEasy and prove that already announced turns are not announced
   again.
7. Mute the Completions channel, complete a turn, see it recorded but not
   spoken, then replay it manually.
8. Close or invalidate the subscribed Codex task and prove SpeakEasy fails
   closed without selecting another task.

## Tests

At minimum, add tests for:

- subscription persistence and migration
- baseline behavior that ignores existing history
- `(taskID, turnID)` deduplication
- durable cursor recovery across restart boundaries
- task ownership and protocol failure
- queue priority between interactive speech and completion speech
- mute, replay, and unsubscribe behavior
- observer cancellation and cleanup
- structured bridge parsing for a completed turn

## Non-goals

- narrating every tool call or token stream
- automatic subscriptions based on focus, recent activity, project path, or
  task title
- sending messages into subscribed tasks
- replacing Codex notifications globally
- a general-purpose notification center
- whole-project or all-task subscription in the first slice
- hidden conversational memory or shadow transcripts

## Likely implementation surfaces

- `app/Sources/SpeakEasy/CodexThreadRouter.swift`
- `app/Sources/SpeakEasy/Resources/codex-desktop-bridge.cjs`
- `app/Sources/SpeakEasy/ListeningSessionController.swift`
- `app/Sources/SpeakEasy/ListeningPopoverSection.swift`
- `app/Sources/SpeakEasy/PlaybackEngine.swift`
- Deck snapshot/protocol and activity presentation
- focused Swift and bridge tests under `app/Tests/SpeakEasyTests`

Keep the observer and subscription store as separate types rather than growing
the interactive listening state machine into a background notification engine.
