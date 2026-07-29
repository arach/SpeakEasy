# SpeakEasy dual-mode website narrative

Status: implementation brief
Date: 2026-07-28

## Assignment

Reframe SpeakEasy from a general-purpose TTS package into the two-way voice
layer it has become: speak to an exact Codex task, then hear that task's real
response through a controllable native player. Make the current release,
technical preview, Codex integration boundary, Claude expansion path, and
installation options understandable in one pass.

## Product truth

SpeakEasy has two modes that meet in one explicit conversation loop:

1. **Listen (ASR):** the native Mac app records one user-triggered utterance,
   transcribes it locally with embedded Vox/Parakeet, and sends the final text
   to the exact Codex Desktop task the user selected.
2. **Speak (TTS):** SpeakEasy renders the real response with the configured
   system or cloud voice and plays it through a permanent menu-bar player with
   queueing, transport controls, playback speed, volume, a live HUD, and a link
   back to the originating task.

Codex owns the conversation. SpeakEasy is the voice conduit. It does not create
a shadow app-server conversation, infer a task from window focus, listen
ambiently, or act as a general voice assistant.

Nine persistent voice lanes make exact tasks addressable with
`Command-Option-1...9`. `Control-Option-Space` starts and ends one utterance for
the current lock.

The signed 0.2.17 release and packaged plugin establish the stable TTS/player
surface. The two-way Codex listening loop is merged on `master` as an opt-in
technical preview and depends on a private, version-checked Codex Desktop IPC
seam. The public plugin-directory submission is packaged but blocked on
publisher verification. The public site must not collapse these different
readiness levels into one claim.

Claude support today is one-way TTS through hooks. The intended expansion is to
apply the same explicit listen -> exact conversation -> spoken response model
to Claude after the Codex path is hardened. Do not claim two-way Claude support
yet.

## Narrative audit

### What is already strong

- The native player, HUD, signed DMG, and provider story have clear proof.
- The listening-mode design document is unusually precise about routing,
  privacy, failure behavior, and task ownership.
- Voice lanes create a distinctive interaction model instead of a generic mic
  button.
- System speech and local transcription make the default loop understandable
  without requiring a cloud voice provider.

### Where the current site is muddy

- The metadata and hero still call SpeakEasy a "Unified Text-to-Speech
  Library."
- The homepage leads with SDK/CLI mechanics instead of the conversation loop.
- Claude hook notifications receive more narrative weight than the much deeper
  Codex integration.
- TTS, the native player, the plugin, the listening preview, and the SDK read
  like separate products.
- Installation does not distinguish the signed stable app, CLI/SDK, packaged
  Codex plugin, and source-only listening preview.

## Message hierarchy

### Audience

Mac-based developers and agent users who work in long-running Codex tasks and
want a deliberate hands-free conversation loop without surrendering task
identity or running an ambient assistant.

### Category

An exact-task voice layer for coding agents.

### Positioning

SpeakEasy gives Codex a two-way voice on the Mac: local speech recognition in,
controllable narration out, always routed through the exact task the user
chooses.

### Master line

**Speak to Codex. Hear it answer.**

### Supporting line

A two-way voice layer for serious work: local speech recognition in,
controllable narration out, locked to the Codex task you choose.

### Message pillars

1. **Two modes, one loop.** Listen and Speak are one product, not unrelated ASR
   and TTS utilities.
2. **Exact task, every time.** Explicit locks and numbered lanes make routing
   inspectable. SpeakEasy never guesses from window focus.
3. **Native control.** The Mac app owns the mic, visible state, playback queue,
   transport, HUD, and interruption behavior.
4. **Local where it matters.** Transcription is local; system narration needs
   no account. Cloud voices are an explicit choice.
5. **Codex first, Claude next.** Codex proves the deep loop. Claude hooks work
   for spoken notifications today; two-way conversation is the next adapter.

## What not to say

- Do not call listening a supported public Codex API integration.
- Do not imply the current signed 0.2.17 DMG contains the complete listening
  preview unless a new release is cut from current `master`.
- Do not claim that the Codex plugin is publicly listed before directory review
  is complete.
- Do not claim two-way Claude conversation today.
- Do not describe listening as ambient, always-on, wake-word driven, or a
  general assistant.
- Do not lead with "AI productivity," "unified TTS," or provider count. Those
  are implementation details, not the product truth.

## Page roles

### Homepage

Explain the complete loop, show why exact-task routing matters, separate stable
and preview readiness, and route people to installation.

### Install

Offer three explicit paths:

1. signed Mac app for stable TTS/player use;
2. CLI/SDK for scripts and integrations;
3. source build for the Codex listening technical preview until it is included
   in a signed release.

Show the packaged Codex plugin as "directory listing in progress," not as an
available install command.

### Documentation

Keep provider, cache, CLI, and SDK documentation as the advanced layer. Add a
focused listening guide before the preview graduates.

## Homepage spine

1. **Promise:** Speak to Codex. Hear it answer.
2. **Mechanism:** voice -> local transcript -> exact task -> response -> voice.
3. **Dual mode:** Listen and Speak are independently legible.
4. **Differentiation:** explicit task locks and nine lanes.
5. **Trust:** user-triggered, half-duplex, local transcription, fail-closed
   Desktop bridge.
6. **Expansion:** Codex first, Claude next.
7. **Action:** install stable SpeakEasy or try the technical preview.

## Readiness language

| Surface | Website label | Current truth |
| --- | --- | --- |
| Signed native player + TTS | Available now | Published as 0.2.17 |
| CLI and SDK | Available now | Published on npm |
| Codex skill/plugin bundle | Packaged; listing in progress | Submission blocked on publisher verification |
| Exact-task listening + lanes | Technical preview | Merged on `master`, not in the 0.2.17 release |
| Claude spoken hooks | Available now | One-way notifications through hooks |
| Two-way Claude conversation | Next | Not implemented |
