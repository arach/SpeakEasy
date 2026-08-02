# SpeakEasy plugin

SpeakEasy gives Codex and ChatGPT Work a controllable voice through a permanent native macOS
menu-bar player. It bundles the SpeakEasy CLI runtime and does not require a global SpeakEasy npm
installation.

## What it does

- Generates speech with the zero-configuration macOS system voice or a configured cloud provider.
- Autoplays or queues narration in the signed SpeakEasy menu-bar app.
- Controls pause, resume, stop, skip, scrubbing, volume, and playback speed.
- Shows a word-synced HUD and can return to the originating Codex task when a task identifier is
  available.

## Requirements

- macOS 14 or newer
- Bun 1.0 or newer
- The signed SpeakEasy app, which the bundled runtime can download from the official GitHub release
  when the user asks to install or use SpeakEasy

System speech needs no account or API key. Optional OpenAI, ElevenLabs, Groq, and Gemini voices use
credentials configured locally by the user.

## Privacy

Narration uses the local macOS voice by default. When a cloud provider is explicitly configured or
selected, the requested text is sent directly to that provider. See the
[privacy policy](https://speakeasy.arach.dev/privacy/) and
[terms](https://speakeasy.arach.dev/terms/).

## Support

Use the [documentation](https://speakeasy.arach.dev/docs/) or file an issue in the
[SpeakEasy repository](https://github.com/arach/SpeakEasy/issues). Do not include API keys in an
issue.

## Build the submission bundle

From the repository root, run `bun run package:plugin-submission`. The command rebuilds the bundled
runtime, verifies the skill in an isolated extracted directory, and writes the versioned skill ZIP
and its SHA-256 file under `dist/`. Complete `RELEASE-CHECKLIST.md` before uploading that ZIP.
