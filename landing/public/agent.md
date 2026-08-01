# SpeakEasy — instructions for coding agents

> SpeakEasy gives agents a voice: spoken summaries through a text-to-speech CLI,
> and on macOS a native menu-bar player with a word-synced HUD. This page is a
> runbook. Two installs are below — pick the one that matches your host, follow it
> exactly, and verify before speaking. No API keys are required; the macOS system
> voice is the default.

## Path A — npm CLI (any agent, any host with Node 18+)

Install ad hoc, nothing written to the project (preferred):

```bash
npx @arach/speakeasy --version
```

Or into the project, if the user wants it as a dependency:

```bash
npm install @arach/speakeasy
```

Verify — exercise the full audio pipeline without playing sound:

```bash
npx @arach/speakeasy --provider system --silent "SpeakEasy check."
```

Exit code 0 means generation works. Non-zero means run
`npx @arach/speakeasy --doctor`, read its output, and report what it found. Do
not speak real summaries until this check passes.

Then, when you finish a task, speak a one-sentence summary:

```bash
npx @arach/speakeasy --provider system "<one sentence, plain words>"
```

Summary rules: under ~15 words, spoken style, no emoji, no code, no file paths.
Say what changed, e.g. "Done, the login form now validates email addresses."

## Path B — Codex skill (macOS 14+, Bun)

The native skill plays through the signed SpeakEasy menu-bar player: autoplay,
queue, transport controls, playback speed, and a word-synced HUD. Install it:

```bash
npx @arach/speakeasy plugin codex
```

This downloads the skill from the latest GitHub release into
`~/.codex/skills/speakeasy` and runs a health check. Then start a new Codex
session so it scans the skill, and follow the SKILL.md. If the SpeakEasy app is
missing, the runtime downloads the signed, notarized app from the official
GitHub release — run that install only when the user has asked to use or
install SpeakEasy. (`speakeasy plugin claude` installs the same skill for
Claude Code.)

## The deck (only when the user asks)

```bash
npx @arach/speakeasy deck
```

Leave the process running. It serves the SpeakEasy control surface on the local
network and prints a QR code — the user scans it with an iPad and pins the page
to their Home Screen. Ctrl+C stops the server. Themes ride in the URL:
`?theme=paper|ember|flight`.

## Boundaries

- Always: verify with the silent check (Path A) or `--doctor` (Path B) before
  the first real summary; use `--provider system` unless the user has configured
  another provider.
- Ask first: before installing into the project instead of `npx`; before
  downloading the native app; before starting the deck server.
- Never: speak secrets, tokens, keys, or credentials; ask the user for API keys
  or write keys to config yourself. If a cloud voice is wanted, point the user
  to `npx @arach/speakeasy --doctor`.

## Reference

- [npm package](https://www.npmjs.com/package/@arach/speakeasy): versions and install stats
- [Docs](https://speakeasy.arach.dev/docs): full CLI reference
- [Codex plugin source](https://github.com/arach/SpeakEasy/tree/master/plugins/speakeasy): skill, runtime, submission notes
- [GitHub](https://github.com/arach/SpeakEasy): source and issues
