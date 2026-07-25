# Thread-locked listening mode

Status: working vertical-slice prototype
Date: 2026-07-25

## Product boundary

The product is one explicit loop:

> Lock SpeakEasy to one Codex task, press a hotkey to record one utterance,
> transcribe it locally with Vox, submit the final text to that exact Desktop
> task, and narrate that task's real response with the configured SpeakEasy
> voice.

SpeakEasy is a conduit. Codex Desktop remains the conversation owner. This is
not a general assistant, ambient recorder, wake-word service, or hidden second
conversation.

## Integration decision

The prototype uses three boundaries grounded in the current repositories:

1. **SpeakEasy.app owns the interaction.** It owns the exact task lock, Carbon
   hotkey, visible state, cancellation, half-duplex policy, and playback.
2. **Vox is embedded as Swift packages.** `VoxCore` and `VoxEngine` provide
   `MicrophoneFileRecorder` and local Parakeet transcription. There is no Vox
   app, CLI, clipboard, or accessibility-paste dependency.
3. **A narrow bundled bridge joins Codex Desktop's existing task lifecycle.**
   It connects to Desktop's private user-owned local IPC socket, asks the
   Desktop window that owns the exact task ID to start the turn, and observes
   that same task's rollout until the returned turn ID completes.

The previous `codex app-server` child approach was rejected. App-server is a
separate host and therefore creates exactly the shadow-session ambiguity the
product must avoid. The shipping path never starts app-server and never writes
Codex SQLite or rollout files.

The Desktop IPC seam is private and versioned, not a supported public Codex
API. The bridge therefore checks exact protocol versions, socket ownership,
directory permissions, Desktop task ownership, returned task and turn IDs, and
rollout location. Any mismatch fails closed with a visible error. There is no
app-server, clipboard, UI-scripting, or title-matching fallback.

## Confirmed versus assumed Codex capabilities

Confirmed public capabilities:

- `codex://threads/<id>` opens an existing task in Codex Desktop.
- `codex app-server` is an experimental, separately launched local server. It
  is useful for independent clients but is not proof that a turn belongs to an
  already-open Desktop task.
- Remote Control is a separate CLI feature, not a supported local Desktop
  submission protocol.

Confirmed by inspection and live testing against the installed Codex Desktop
build (`0.146.0-alpha.3.1`):

- Desktop exposes a current-user-only length-prefixed JSON IPC socket at
  `$CODEX_HOME/ipc/ipc.sock`.
- A follower can announce an exact local task ID and receive a snapshot from
  the Desktop renderer that owns that task.
- `thread-follower-start-turn` causes that owning renderer to start the real
  turn and returns its turn ID.
- The snapshot contains the exact rollout path used by the Desktop-owned task;
  completion can be correlated to the returned turn ID.
- A disposable task accepted a bridge submission and returned
  `DESKTOP_CONDUIT_OK` through the already-open Desktop conversation without a
  child app-server.

Not confirmed and not relied upon:

- A public supported API for sending a prompt to an existing Desktop task.
- A public API for discovering the currently focused Desktop task.
- Compatibility of the private IPC protocol across Desktop releases.
- Safe concurrent injection while the target task already has an active turn.

This is suitable as an opt-in technical preview. A durable release should
replace the private seam with a supported Desktop extension/API when one is
available.

## Task-lock model

`ListeningTaskLock` contains exact `id`, display `title`, and `cwd`. Only `id`
is routing authority; title, recency, and directory are display metadata.

Rules:

- The user explicitly selects and locks a task. SpeakEasy opens its exact deep
  link and accepts the lock only after that Desktop window answers the follower
  handshake.
- The lock is snapshotted before an utterance. Later selection or focus changes
  cannot redirect that utterance.
- Desktop focus changes never silently change the lock.
- Switching clears the prior persisted lock before validation. A failed switch
  leaves the app unlocked rather than falling back to the old task.
- A restored lock is revalidated on launch before the hotkey becomes useful.
- Unlock cancels capture; during narration it also stops the SpeakEasy-owned
  playback item. Submission and synthesis are not silently rerouted.
- If the task is not open and owned by a Desktop renderer, validation/submission
  fails with an instruction to open it. The bridge never resumes it elsewhere.

## Interaction loop

```text
unlocked
  -> validatingLock
  -> ready
  -> cueing (assigned lane with a cached cue only)
  -> opening microphone + concurrent Vox warmup
  -> recording
  -> transcribing
  -> submitting
  -> preparingSpeech
  -> speaking
  -> ready
```

1. Pick and lock an exact task.
2. Press `Control-Option-Space`. SpeakEasy stops its playback, opens the
   microphone immediately, and warms Vox in parallel with the utterance.
3. Press the hotkey again to end the utterance. A 120-second ceiling prevents
   accidental indefinite capture.
4. Vox transcribes the temporary audio locally. Empty transcripts do not
   submit; the raw file is deleted after transcription or cancellation.
5. SpeakEasy submits exactly once through the owning Desktop task. An idle task
   receives a new turn; an active task receives an explicit Desktop steer event
   and remains the same turn. SpeakEasy waits for the final assistant message
   from that exact new or active turn ID.
6. SpeakEasy renders that response with its explicitly configured provider,
   model, voice, rate, and API key, then queues it with the originating task ID.
   Provider failure is visible and never silently downgraded to macOS `say`.
7. Playback completion returns the task lock to `ready`. There is no automatic
   re-engagement.

The first slice uses toggle recording because the existing Carbon abstraction
has a dependable global pressed event but no tested global key-up lifecycle.
Push-to-talk can follow after key-up, sleep, and lost-event behavior are proven.

### Voice lanes

Nine persistent voice lanes map `Option-Command-1` through
`Option-Command-9` to exact task locks. A lane shortcut selects its task,
revalidates Desktop ownership, and begins listening in one action. The original
`Control-Option-Space` shortcut continues toggling the current lock.

- Lane registration is independent; a chord conflict disables only that lane
  and is shown in the popover.
- An unassigned lane never guesses a task. The popover explains how to assign
  the current exact lock.
- A lane cannot reroute audio already being recorded or a turn already being
  submitted. The current utterance keeps its snapshotted task ID.
- Assignment generates a compact task-name cue with the configured premium
  provider. Cues are cached privately. A cached cue finishes before capture to
  prevent feedback; a missing/failed cue is skipped without system-voice
  fallback or microphone delay.
- Every lane activation reopens and revalidates the exact task, including after
  app restarts or Codex task changes.

## Interruption and echo prevention

The loop is half duplex. Starting a recording always stops current SpeakEasy
playback before opening the microphone, which prevents the app from
transcribing its own narration.

- During recording, the second hotkey submits; the popover cancel control
  discards the recording without transcription.
- During narration, the hotkey stops playback and immediately starts a new
  utterance (barge-in). This is intentionally small behavior, not a prerequisite
  for routing correctness.
- During validation, transcription, submission, and synthesis, repeated hotkey
  presses beep rather than starting duplicate work.
- Unlock stops narration. Late results are checked against the snapshotted task
  ID and discarded if the lock changed.

A future version may support interrupting a SpeakEasy-owned Codex turn, but it
must correlate and interrupt only that returned turn ID. Steering adds context
to an active turn; it does not interrupt or replace it.

## Privacy, permissions, and accessibility

- The signed app declares microphone usage and the audio-input entitlement.
- Carbon hotkey registration requires neither Accessibility nor Input
  Monitoring permission.
- The menu bar and popover visibly distinguish locked, warming, listening,
  transcribing, waiting, preparing speech, speaking, and failed states.
- Controls and status text have accessible labels; status never depends on
  animation or color alone.
- Microphone audio is stored only in a temporary file for the explicit
  utterance and deleted after transcription/cancel. Raw input and transcripts
  are not added to SpeakEasy history.
- Generated response audio is mode `0600` and removed after playback. Existing
  provider cache behavior remains governed by SpeakEasy settings.
- Listening is never ambient: it starts only from the explicit hotkey/control,
  stops explicitly or at 120 seconds, and never auto-rearms.

Vox currently produces a whole-utterance final transcript. Partial text is not
invented in the UI. If Vox gains reliable streaming output, partials may be
shown as non-submittable previews; only the final generation may route.

## Failure and recovery

- Microphone denied: preserve the lock and show the macOS permission remedy.
- Missing input device or device removal: cancel capture; never submit partial
  audio.
- Empty/failed transcription: preserve the lock and return a visible error.
- Desktop unavailable, task closed, protocol changed, or unsafe socket/path:
  fail closed and preserve the transcript for visibility; never use another
  task or host.
- Task already busy: use Desktop's explicit same-task steer operation and
  correlate playback to the currently active turn. If its active turn ID cannot
  be proven from the private rollout, fail closed before submission.
- Provider/key/network failure: show narration failure; never substitute a
  system voice unless `system` is the configured provider.
- App restart: any capture/work is abandoned and a persisted lock must pass a
  new Desktop ownership handshake.

## Side inference boundary

No side agent is needed for the shippable first loop. Deterministic transcript
trim and Markdown-to-speech flattening keep the route inspectable and fast.

OpenScout's local session runner is a useful design reference for a later
bounded `VoiceTextProjector`, with two allowed operations:

```ts
interface VoiceTextProjector {
  cleanTranscript(text: string, signal: AbortSignal): Promise<string>;
  summarizeForSpeech(text: string, signal: AbortSignal): Promise<string>;
}
```

Hard constraints:

- The helper receives text, never the Codex task ID or Desktop bridge.
- It cannot submit, resume, steer, interrupt, select, or persist a conversation.
- Its output is bounded and cancelable; newest utterance wins.
- Transcript cleanup must preserve meaning and display the submitted final text.
- Speech summarization changes only narration, never the actual task response.
- Failure falls back to deterministic trim/flatten without changing routing.

This keeps the main task as the only conversational memory while still allowing
tight inference loops where they improve listening quality.

## Smallest shippable slice

Included in this prototype:

- explicit exact-ID Desktop-validated lock
- `Control-Option-Space` toggle capture
- persistent exact-task lanes on `Option-Command-1...9`
- embedded Vox final transcription
- exact Desktop-owned submission and response correlation
- explicit same-task steering when the locked task is already active
- configured provider/voice narration with no implicit system fallback
- playback barge-in, recording cancel, 120-second limit, privacy indicators,
  relaunch revalidation, and fail-closed errors

Explicit non-goals:

- ambient listening, wake words, VAD auto-submit, or auto-reengagement
- partial transcript submission
- inferred task selection or following Desktop focus
- a shadow Codex/app-server thread
- side-agent ownership of routing or conversational history
- generalized voice-assistant tools/actions
- concurrent turn merging or arbitrary active-turn interruption
- production compatibility promises for private Desktop IPC

## Staged path

1. **Technical preview:** ship the current exact-task toggle loop behind an
   opt-in label and collect compatibility/latency/failure telemetry without
   storing transcript content.
2. **Interaction polish:** add reliable push-to-talk key-up, Escape cancel,
   optional transcript review, stronger VoiceOver announcements, and device
   change recovery.
3. **Speech modes:** persist per-task `off`, `full`, and `summary` settings. Add
   the bounded projector only for cleanup/summary, never routing.
4. **Endpointing:** evaluate local VAD and echo cancellation only with prominent
   indicators and conservative no-auto-submit defaults.
5. **Supported host contract:** migrate from inspected private IPC to a public
   Codex Desktop integration when available, retaining the same exact-lock and
   fail-closed invariants.

## Validation record

- Read-only Desktop follower snapshot succeeded for the originating task
  `019f99a4-7867-7c23-ac29-0c0eca7da603`.
- A live bridge turn on disposable Desktop task
  `019f99ba-2ae5-7fc2-abef-32000a7f09f2` returned
  `DESKTOP_CONDUIT_OK` from the exact visible task with no child app-server.
- The signed app then completed a live loop on the originating task
  `019f99a4-7867-7c23-ac29-0c0eca7da603`: Vox transcribed a spoken fixture into
  the visible 72-character user message, the Desktop bridge explicitly steered
  the active turn, the response was `Exact task voice loop passed.`, ElevenLabs
  queued the audio, and the native player logged playback completion.
- The signed lane build registered all nine `Option-Command` shortcuts, restored
  lane 1 to the originating task, revalidated the exact task, played a cached
  ElevenLabs task-name cue before capture, opened the MacBook Air microphone,
  warmed Vox concurrently, and canceled the validation recording without
  transcription or submission.
- `node --check` passes for the bundled bridge.
- `pnpm build` passes for the TypeScript package.
- `pnpm test:privacy` passes both privacy tests.
- `swift test` passes all native tests, including protocol compatibility,
  temporary-audio cleanup encoding, Markdown narration flattening, safe deep
  links, settings bounds, and Gemini PCM-to-WAV wrapping.
- `app/build-app.sh` produces a signed app containing the Vox resources,
  microphone usage description, audio-input entitlement, and bundled Desktop
  bridge; `codesign --verify --deep --strict` passes.

The app-level utterance-to-response-to-premium-playback gate is satisfied.
SpeakEasy remains locked to the originating task for normal global-hotkey use.
