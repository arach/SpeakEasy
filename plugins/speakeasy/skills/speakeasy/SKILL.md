---
name: speakeasy
description: Generate text-to-speech audio and control it through the permanent native SpeakEasy macOS menu-bar player. Use for narration, voice notes, spoken summaries, voice/provider tests, autoplay, queue management, pause/resume/stop, scrubbing, volume, playback speed, player status, or returning from the live HUD to the originating Codex task.
---

# SpeakEasy

Use the bundled SpeakEasy runtime to generate audio, then send it to the permanent native macOS player. The player owns autoplay, the queue, transport controls, volume, playback speed, the live transcript HUD, and the link back to the originating Codex task.

## Requirements and first use

- SpeakEasy's native player requires macOS 14 or newer.
- `bun` must be available to run the bundled scripts and CLI runtime.
- System voices work without an API key. OpenAI, ElevenLabs, Groq, and Gemini require provider configuration stored by SpeakEasy on the user's Mac.
- If the player is not installed, explain that `speakeasy-runtime.ts --app` downloads the signed and notarized app from the official SpeakEasy GitHub release. Run the install command only when the user has asked to use or install SpeakEasy.

Resolve all script paths relative to this `SKILL.md`. Never assume a global `speakeasy` installation.
On a non-macOS host or a Mac running macOS 13 or older, do not attempt installation, generation, or
player control; explain that the permanent player requires macOS 14 or newer.

```bash
bun scripts/speakeasy-runtime.ts --app
bun scripts/speakeasy-runtime.ts --doctor
```

Do not display API keys, provider credentials, or other secrets. Prefer `--doctor` for configuration diagnostics. If a provider needs configuration, suggest the native app or the provider-specific `--set-key` command without asking the user to paste a key into chat.

## Generate and play narration

1. Create or reuse `speakeasy-session.json` in the current task's visualization directory. Default to `{"autoplay":true,"player":"external"}`. Add `wordsPerMinute` only when the user explicitly asks for a synthesis-rate target.
2. Preserve supplied text exactly. For prose written by Codex, make only light speech-oriented edits without changing meaning.
3. Save generated audio to a descriptive, extensionless absolute path under `/tmp`. An extensionless path remains valid whether the selected provider returns MP3, AIFF, or another supported format.
4. Run `scripts/render-audio.ts` with `--text`, `--out`, and `--settings`. Pass provider, voice, volume, instructions, or rate only when requested. Without an explicit provider, the bundled CLI honors the user's configured default provider and voice, falling back to the best available macOS system voice when no provider is configured.
5. Confirm that the output exists and is non-empty.
6. Run `scripts/control-player.ts --audio <path> --title <title> --text <complete spoken text>`. Add `--no-autoplay` when task settings disable autoplay. Always pass the complete spoken text so the HUD can follow it. The controller attaches `CODEX_THREAD_ID` when available so the HUD can return to the task.
7. Treat `Playback started` as the success acknowledgement for autoplay requests. `Queued` means the item has not started yet; do not describe it as playing.
8. Keep the response brief. Name a selected provider or voice only when it helps distinguish variants.

```bash
bun scripts/render-audio.ts \
  --text "A short spoken update." \
  --out /tmp/codex-speakeasy-update \
  --settings /absolute/task-visualization-dir/speakeasy-session.json

bun scripts/control-player.ts \
  --audio /tmp/codex-speakeasy-update \
  --title "Spoken update" \
  --text "A short spoken update."
```

Do not invoke direct system playback or raw `afplay`. Generate silently and let the permanent player decide whether to autoplay.

## Control the player

Act immediately on player-control requests:

```bash
bun scripts/control-player.ts --pause
bun scripts/control-player.ts --resume
bun scripts/control-player.ts --toggle
bun scripts/control-player.ts --stop
bun scripts/control-player.ts --skip
bun scripts/control-player.ts --seek 12.5
bun scripts/control-player.ts --volume 0.7
bun scripts/control-player.ts --playback-rate 1.25
bun scripts/control-player.ts --clear-queue
bun scripts/control-player.ts --status
```

- Playback speed changes the current item immediately and does not regenerate audio.
- `wordsPerMinute` changes generated audio. It is optional and requires `ffmpeg` plus `ffprobe` for providers that do not apply synthesis rate themselves.
- `--no-autoplay` affects only the newly queued item.
- Stop asks the permanent player to stop; never terminate unrelated audio processes.

## Failure handling

- If the native app is missing, use the bundled runtime's `--app` command after the user asks to install or use SpeakEasy.
- If the player cannot start, report the player error rather than falling back to a second player.
- If a provider is not configured, suggest `--doctor`, the native settings app, or `--set-key <provider>` without exposing credentials.
- If generation fails or the output is empty, do not queue a broken item.
- If explicit WPM retiming is requested and `ffmpeg` or `ffprobe` is missing, explain that optional dependency instead of silently ignoring the requested rate.
