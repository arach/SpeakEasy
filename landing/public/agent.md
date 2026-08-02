# SpeakEasy — instructions for coding agents

> SpeakEasy is a dual-mode voice companion: spoken agent responses through its
> native player, and local dictation routed into an exact Codex Desktop task.
> This page is an agent runbook. Pick the smallest path that satisfies the user's
> request, follow it exactly, and report every check. No API keys are required;
> the macOS system voice is the default.

## Path A — full Codex voice loop (recommended on Apple silicon Macs)

Use this when the user asks to install the native app, use Mac dictation, or
speak with a real Codex task. Release `0.2.19` is the first complete dual-mode
build for an Apple silicon Mac running macOS 14 or newer. It includes the
paired-HTTPS browser/iPad Deck and exact-task Mac voice loop.

Download the pinned installer to a temporary file. **Inspect it before running;
do not pipe a network response directly into a shell.**

```bash
installer="$(mktemp "${TMPDIR:-/tmp}/install-speakeasy.XXXXXX")"
curl --fail --location --proto '=https' --tlsv1.2 \
  https://github.com/arach/SpeakEasy/releases/download/v0.2.19/install-speakeasy.sh \
  --output "$installer"
sed -n '1,260p' "$installer"
bash -n "$installer"
bash "$installer"
rm -f "$installer"
```

The installer must pass all of these before it changes `/Applications`:

- published SHA-256 for the exact `0.2.19` DMG;
- Gatekeeper acceptance of the signed, notarized DMG and app;
- bundle ID `com.speakeasy.config` and Developer ID team `2U83JFPW66`;
- exact app version `0.2.19`.

It then opens **SpeakEasy Settings → Deck**. Report which checklist rows are
ready and which human-only steps remain. The user—not the agent—approves
microphone, local-network, and one-time certificate trust. Do not bypass
Gatekeeper, remove quarantine attributes, install a floating `latest` build,
or build from source.

## Path B — TTS CLI only (Node.js 22.12+ or Bun 1.0+)

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

## Path C — Codex skill and native playback controls (macOS 14+, Bun)

The native skill plays through the signed SpeakEasy menu-bar player: autoplay,
queue, transport controls, playback speed, and a word-synced HUD. Install it:

```bash
npx @arach/speakeasy plugin codex
```

This downloads the skill from the latest GitHub release into
`~/.codex/skills/speakeasy` and runs a health check. Then start a new Codex
session so it scans the skill, and follow the SKILL.md. Use Path A for the
full dual-mode app instead of relying on the older CLI app bootstrap.
(`speakeasy plugin claude` installs the same skill for Claude Code.)

## The Deck

```bash
npx @arach/speakeasy deck
```

The signed `0.2.19` app starts this runtime for you. For a CLI-only development
run, leave the process running. It serves the paired HTTPS control surface on
the local network and prints the certificate-bootstrap link plus QR code. Trust
the local CA on the iPad first, then scan the HTTPS QR and pin the page to the
Home Screen. Ctrl+C stops the server.

## Boundaries

- Always: preserve the exact release pin and trust checks in Path A. For the TTS
  CLI, verify with the silent check or `--doctor` before the first real summary;
  use `--provider system` unless the user has configured another provider.
- Ask first: before installing into the project instead of `npx`; before
  downloading the native app when the user's request did not already authorize
  installation; before starting the deck server.
- Never: speak secrets, tokens, keys, or credentials; ask the user for API keys
  or write keys to config yourself. If a cloud voice is wanted, point the user
  to `npx @arach/speakeasy --doctor`.

## Reference

- [npm package](https://www.npmjs.com/package/@arach/speakeasy): versions and install stats
- [Docs](https://speakeasy.arach.dev/docs): full CLI reference
- [Codex plugin source](https://github.com/arach/SpeakEasy/tree/master/plugins/speakeasy): skill, runtime, submission notes
- [GitHub](https://github.com/arach/SpeakEasy): source and issues
