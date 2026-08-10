# SpeakEasy — instructions for coding agents

> SpeakEasy is unified text-to-speech: one API across the macOS system voice,
> OpenAI, ElevenLabs, Groq, and Gemini. Most users want exactly that — a way to
> speak a summary out loud without wiring up a provider.
>
> There is also a signed macOS app with a companion control surface built for
> Codex. It is a distinct, larger commitment. Do not steer anyone toward it
> unless they asked for it.
>
> Pick the smallest path that satisfies the request, follow it exactly, and
> report every check. No API keys are required; the system voice is the default.

## Choosing a path

| The user wants | Use |
|---|---|
| To speak text, or hear task summaries | **Path 1** — the CLI |
| Spoken replies inside Codex or Claude Code, with player controls | **Path 2** — the skill |
| The Mac app, dictation into an exact Codex task, or the Deck | **Path 3** — the app |

When the request is ambiguous, choose Path 1. It installs nothing permanent,
needs no keys, and is reversible.

## Path 1 — text-to-speech (Node.js 22.12+ or Bun 1.0+)

This is the default. Run it ad hoc; write nothing into the project:

```bash
npx @arach/speakeasy --version
```

Install as a dependency **only** if the user asked for it:

```bash
npm install @arach/speakeasy
```

**Verify before speaking anything real.** This exercises the full audio
pipeline without making a sound:

```bash
npx @arach/speakeasy --provider system --silent "SpeakEasy check."
```

Exit code 0 means generation works. Non-zero means run
`npx @arach/speakeasy --doctor`, read its output, and report what it found. Do
not speak real summaries until this check passes.

Then, at the end of a task, speak one sentence:

```bash
npx @arach/speakeasy --provider system "<one sentence, plain words>"
```

Summary rules: under ~15 words, spoken style, no emoji, no code, no file paths.
Say what changed — "Done, the login form now validates email addresses."

**Choosing a voice.** `--provider` selects the engine, `--voice` the voice
within it, `--rate` the speed, `--out <path>` writes a file instead of playing.
Defaults live in the user's config; `--doctor` prints the configured voice for
each provider. Use `--provider system` unless the user has configured another
one — it needs no key and always works on macOS.

## Path 2 — spoken replies in Codex or Claude Code

Installs a skill that generates audio and drives the native menu-bar player:
autoplay, queue, transport controls, volume, playback speed, and a word-synced
transcript HUD.

```bash
npx @arach/speakeasy plugin codex
```

This downloads the skill from the latest GitHub release into
`~/.codex/skills/speakeasy` and runs a health check. Start a new Codex session
afterwards so it scans the skill, then follow its `SKILL.md`.
(`speakeasy plugin claude` installs the same skill for Claude Code.)

Requires macOS 14 or newer and `bun`. On an older macOS or a non-Mac host, stop
and say so rather than attempting it.

## Path 3 — the Mac app and the Codex Deck

Use this **only** when the user explicitly asks to install the native app, use
Mac dictation, or drive a real Codex task by voice. It installs a signed
application into `/Applications` and requires human approval of system prompts.
Do not offer it as an upgrade to Path 1.

Requires an Apple silicon Mac running macOS 14 or newer.

Download the current installer to a temporary file. **Inspect it before running;
do not pipe a network response into a shell.**

```bash
installer="$(mktemp "${TMPDIR:-/tmp}/install-speakeasy.XXXXXX")"
curl --fail --location --proto '=https' --tlsv1.2 \
  https://github.com/arach/SpeakEasy/releases/latest/download/install-speakeasy.sh \
  --output "$installer"
sed -n '1,260p' "$installer"
bash -n "$installer"
bash "$installer"
rm -f "$installer"
```

That URL always resolves to the current release, so there is no version for you
to look up or keep in sync. The installer names the version it is about to
install in its own output and in its `DEFAULT_VERSION` line — read it there
rather than assuming one. Report that version back to the user when you are
done.

The installer refuses to touch `/Applications` unless all of these pass:

- the published SHA-256 for the exact DMG it names;
- Gatekeeper acceptance of the signed, notarized DMG and app;
- bundle ID `com.speakeasy.config` and Developer ID team `2U83JFPW66`;
- an installed app version matching the release it downloaded.

If you need a specific older release instead, set `SPEAKEASY_VERSION` and the
installer will verify against that release's published checksum. Do not do this
unless the user asked for a particular version.

It then opens **SpeakEasy → Settings → Deck**.

### Walking the user through the human-only steps

You cannot approve these; macOS requires a person. Say what is about to happen
before it happens, then confirm each one landed. In order:

1. **Microphone.** "macOS will ask for microphone access — that is dictation
    running on your Mac." Needed only for voice input.
2. **Local network.** "It will ask to find devices on your local network. That
    is how a phone or iPad reaches this Mac. Nothing leaves your network."
3. **Settings → Deck checklist.** Read the rows back. Report which are ready
    and which are still red, in plain words.

Then stop and report. Do not attempt to clear a red row by changing system
settings on the user's behalf.

### The Deck (browser and iPad)

The app serves a control surface on the local network for a phone or iPad.
Mention it only if the user asks about using another device.

```bash
npx @arach/speakeasy deck
```

For a CLI-only development run, leave the process going; Ctrl+C stops it. The
signed app starts this runtime for you.

Be honest about the cost: reaching it over HTTPS from a phone or iPad currently
requires installing and trusting a local certificate authority on that device —
several steps in iOS Settings. Plain HTTP works without any of that, but Safari
withholds microphone access outside a secure context, so dictation will not
work. Do not walk someone through certificate installation unless they have
asked for the iPad path specifically and accepted that trade.

## When something fails

- **Checksum mismatch** — stop. Do not retry, do not fetch a different build.
  Report the expected and actual values. This means the download is wrong.
- **Gatekeeper or codesign rejection** — stop and report verbatim. Never
  remove quarantine attributes, never `spctl --master-disable`, never bypass.
- **Wrong version or team ID** — stop. The pin exists to catch exactly this.
- **App installs but Deck rows stay red** — that is usually an unapproved
  system prompt, not a broken install. Re-read the human-only steps above.
- **`--silent` check fails** — run `--doctor` and report its output. Do not
  work around it by switching providers.

Never build from source, install a floating `latest` build, or bypass
Gatekeeper as a workaround for any of the above.

## Boundaries

- **Always:** preserve the exact release pin and trust checks in Path 3. Verify
  with the silent check or `--doctor` before the first real summary. Use
  `--provider system` unless the user configured another provider.
- **Ask first:** before installing into the project instead of using `npx`;
  before downloading the native app when the request did not already authorize
  it; before starting the deck server.
- **Never:** speak secrets, tokens, keys, or credentials. Never ask the user for
  API keys or write keys to config yourself — point them at
  `npx @arach/speakeasy --doctor`.

## Reference

- [npm package](https://www.npmjs.com/package/@arach/speakeasy): versions and install stats
- [Docs](https://speakeasy.arach.dev/docs): full CLI reference
- [SpeakEasy for Codex](https://speakeasy.arach.dev/codex/): the Codex companion and Deck
- [Codex plugin source](https://github.com/arach/SpeakEasy/tree/master/plugins/speakeasy): skill, runtime, submission notes
- [GitHub](https://github.com/arach/SpeakEasy): source and issues
