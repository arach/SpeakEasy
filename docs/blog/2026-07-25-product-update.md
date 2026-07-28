# SpeakEasy product update — July 2026

**Status:** publication-ready draft for the marketing site  
**Scope:** features landed on `master` through PR #10 (2026-07-25)  
**Package on npm:** `@arach/speakeasy@0.2.16` (latest published)  
**GitHub app release:** [SpeakEasy 0.2.17](https://github.com/arach/SpeakEasy/releases/tag/v0.2.17)  
**Website:** [speakeasy.arach.dev](https://speakeasy.arach.dev)

---

SpeakEasy is a macOS-first text-to-speech stack: a TypeScript CLI/SDK, a signed menu-bar player, and an optional Codex skill. This update covers what recently shipped, what is only in source after the 0.2.17 DMG cut, and what remains a technical preview.

## Release state at a glance

| Surface | State (2026-07-25) | Evidence |
| --- | --- | --- |
| npm package | Latest published **0.2.16** | `npm view @arach/speakeasy version` |
| Repo package.json | Declares **0.2.17** | `package.json` |
| GitHub app release | **v0.2.17** DMG published | GitHub Releases; notes cite PRs #2 and #3 |
| Permanent menu-bar player + live HUD | In **v0.2.17** release | PR #2, release body |
| Codex plugin packaging | In **v0.2.17** tree / skill bundle | PR #3, `plugins/speakeasy/` |
| Landing page player download section | Merged (PR #4) | `landing/components/download-section.tsx` |
| Thread-locked listening mode | Merged to `master` **after** v0.2.17 | PRs #6–#9 |
| Dedicated microphone picker | Merged to `master` **after** v0.2.17 | PR #10 |

Build from current `master` (or install a post-0.2.17 signed build when published) for listening mode and the microphone picker. The public 0.2.17 DMG is the menu-bar player release, not the listening-mode cut.

## What users can do today

### Permanent menu-bar player (released in 0.2.17)

SpeakEasy.app is a resident menu-bar application (`LSUIElement`) that owns playback:

- Queue, play/pause, stop, skip, scrub, volume, and playback speed
- Optional floating HUD with word-synced narration text
- Optional **Back to Codex** deep link when a validated `sourceThreadId` is present
- Local IPC at `/tmp/speakeasy-player.sock` (protocol version 1)
- CLI synthesis still generates audio; the app plays it when available, with direct playback as a fallback

Sources: `docs/menu-bar-player.mdx`, `app/Sources/SpeakEasy/PlaybackEngine.swift`, GitHub release `v0.2.17`.

### Codex distribution skill (released with 0.2.17 packaging)

The `plugins/speakeasy` skill bundles a CLI runtime so Codex/ChatGPT Work can generate speech and drive the native player without a global npm install. Privacy defaults to the local macOS voice unless a cloud provider is configured.

Sources: `plugins/speakeasy/README.md`, PR #3.

### Thread-locked voice conversations (merged after 0.2.17)

Opt-in technical preview in the menu-bar app:

1. Lock SpeakEasy to one exact Codex Desktop task ID  
2. Press **⌃⌥Space** to record one utterance (toggle; 120s ceiling)  
3. Transcribe on-device (Vox / Parakeet, with Apple Speech while the model warms)  
4. Submit only to that Desktop-owned task via a private local bridge  
5. Narrate the real task response with the configured SpeakEasy provider  

Codex Desktop remains the conversation owner. SpeakEasy is a conduit, not a second assistant. There is no ambient listening, wake word, or silent task switching.

**Voice lanes:** **⌘⌥1…9** map to exact tasks; **⌘⌥X** announces the active lane without opening the mic.

Sources: `docs/listening-mode.mdx`, `docs/listening-mode-feasibility.md`, PR #6 and follow-ups #7–#9.

### Dedicated microphone picker (merged after 0.2.17)

In the listening composer of the menu-bar popover:

- Choose **System Default** or a fixed input by stable device ID
- Preference persists across launches (`speakeasy.listening.input-device.v1`)
- Capture always uses the selected device for that turn
- Unavailable dedicated devices fail visibly — no silent fallback
- Menu includes **Refresh Inputs**; device changes are blocked while busy/recording

Sources: PR #10 (`ListeningPopoverSection.swift`, `ListeningSessionController.swift`, `VoxListeningService.swift`).

### Supporting reliability work (merged after 0.2.17)

- Apple Speech cold-start path while Parakeet warms (`AppleSpeechFileTranscriber.swift`, PR #8)
- First-run Speech Recognition consent surfacing (PR #9)
- Lane routing kept off the main interaction path; HUD layout polish (PRs #7–#8)

## Providers and library baseline (unchanged product core)

Still available through CLI/SDK and config:

- System (macOS `say`), OpenAI, ElevenLabs (voice IDs), Groq Orpheus, Gemini  
- SQLite cache via built-in `node:sqlite` / `bun:sqlite`  
- Normalized `TTSAdapter` for custom backends  
- Global config at `~/.config/speakeasy/settings.json`

Requires Node.js ≥ 22.12 or Bun ≥ 1.0; system voice and the native app are macOS-only.

## What this is not

- Not a general voice assistant or ambient recorder  
- Listening-mode Desktop IPC is private and version-sensitive — fail-closed, technical preview  
- No claim that listening mode or the mic picker ship inside the public **0.2.17** DMG  
- npm latest remains **0.2.16** until a new package publish lands  

## Docs and site

- Product docs: [Menu-bar player](../menu-bar-player.mdx), [Listening mode](../listening-mode.mdx)  
- Site: landing + docs at speakeasy.arach.dev — **no blog/updates route yet**; this file is staged under `docs/blog/` for later publication  

## Get the app

```bash
# Install / open companion app (downloads signed release when needed)
speakeasy --app
speakeasy --update-app

# Or download the latest published DMG
# https://github.com/arach/SpeakEasy/releases/latest/download/SpeakEasy.dmg
```

---

*Factual draft grounded in repository history, GitHub release notes, npm registry state, and app sources as of 2026-07-25. No performance or compatibility claims beyond documented validation records.*
