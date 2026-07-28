---
name: speakeasy
description: Generate text-to-speech audio, control the native SpeakEasy macOS player, and manage thread-locked voice lanes. Use for narration, voice notes, spoken summaries, voice/provider tests, autoplay, queue management, player controls, lane assignment/configuration, viewing or editing lanes, or returning from the live HUD to the originating Codex task.
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

## Manage voice lanes

Voice lanes are a versioned local contract shared with the native app. Always use the bundled lane
manager instead of editing `lanes.json` by hand. Read the current assignments before every mutation,
change only the requested lane, and read once afterward to confirm the result.

```bash
bun scripts/manage-lanes.ts --list
bun scripts/manage-lanes.ts --list --json
bun scripts/manage-lanes.ts --path
```

Assign the current exact Codex task only when `CODEX_THREAD_ID` is available. Pass a useful title and
working directory when known; never infer a task id from its title.

```bash
bun scripts/manage-lanes.ts --assign-current 1 \
  --title "Coordinate the current launch" \
  --cwd /absolute/project/path \
  --label "Primary orchestrator"
```

For another confirmed task, provide its exact id and metadata. Update settings without replacing the
task mapping via `--set`.

```bash
bun scripts/manage-lanes.ts --assign 2 --task-id 019f... --title "Project task" --cwd /absolute/path
bun scripts/manage-lanes.ts --set 2 --label "Main project"
bun scripts/manage-lanes.ts --set 2 --provider openai --voice coral --cue "Be concise."
bun scripts/manage-lanes.ts --set 2 --inherit-voice --clear-cue
bun scripts/manage-lanes.ts --activate 2
bun scripts/manage-lanes.ts --clear 2
```

The manager validates slots 1–9 and writes atomically. The current native app loads external edits on
launch, so describe a mutation as saved rather than live until the app has been relaunched.

### Show the lane editor

When the plugin's `show_lane_editor` MCP tool is available, prefer it for viewing and editing lanes.
Use the available Codex task-listing integration first and pass recent exact task metadata through
the tool's `tasks` argument when practical. The server can reuse the latest local inventory, but an
explicit inventory keeps the project and task pickers current. The MCP UI calls component-only
`preview_voice`, `save_lane`, and `clear_lane` tools directly, so previewing or changing a mapping
does not create a follow-up message or another model turn.

If MCP UI is unavailable, render the plugin's portable interactive lane editor into the current
task's visualization directory and return it inline. First use the available
Codex task-listing integration to collect recent tasks. Write only display/routing metadata—never
messages or transcripts—to a task inventory shaped like this:

```json
{
  "tasks": [
    {
      "id": "019f...",
      "title": "Coordinate the current launch",
      "cwd": "/absolute/project/path",
      "project": "SpeakEasy",
      "projectId": "saved-project-id"
    }
  ]
}
```

Pass that inventory to the renderer. It groups tasks by project/working directory and always merges
in already-assigned lane targets so an older mapping remains editable.

```bash
bun scripts/render-lanes.ts \
  --tasks /absolute/task-visualization-dir/speakeasy-task-inventory.json \
  --out /absolute/task-visualization-dir/speakeasy-lanes.html
```

Then emit `::codex-inline-vis{file="speakeasy-lanes.html"}` on its own line. This fallback does not write
local files directly: its actions send a precise follow-up request, which must be applied with
`manage-lanes.ts` using the read-mutate-read sequence above.

### Preview a lane voice

Use the bundled preview command when an editor action or direct request specifies a provider and
voice. It generates the real provider audio, interrupts only SpeakEasy playback, queues the sample in
the native player, and removes the temporary audio after playback.

```bash
bun scripts/preview-voice.ts \
  --provider openai \
  --voice nova \
  --text "Lane one. Primary orchestrator."
```

Do not preview ElevenLabs by a display name; it requires an exact voice ID. Never expose provider
credentials while inspecting configured providers.

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
