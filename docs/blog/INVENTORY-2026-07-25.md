# SpeakEasy feature inventory — 2026-07-25

Evidence-only inventory for coordinator handoff. No product code was modified for this work.

## Release and registry state

| Item | Value | Evidence |
| --- | --- | --- |
| GitHub release latest | SpeakEasy **0.2.17** (2026-07-25) | `gh release list`; assets `SpeakEasy.dmg`, `SpeakEasy-0.2.17.dmg` |
| Release notes contents | PRs **#2** menu-bar player, **#3** Codex packaging | `gh release view v0.2.17` body |
| npm latest | **0.2.16** | `npm view @arach/speakeasy version` |
| package.json version | **0.2.17** | `/package.json` |
| Homepage | https://speakeasy.arach.dev | package.json `homepage`, `CNAME` |

## Merged product work (recent)

Ordered from `origin/master` history through PR #10:

| Feature | Merge / commit | Release cut | Evidence |
| --- | --- | --- | --- |
| Permanent menu-bar player + live HUD | PR #2 → `19acdf1` | **In v0.2.17** | Release body; `docs/menu-bar-player.mdx`; app `PlaybackEngine`, `PlayerIPCServer`, HUD sources |
| Codex plugin packaging | PR #3 → `253a09e` | **With 0.2.17 packaging** | `plugins/speakeasy/`; RELEASE-CHECKLIST |
| Landing native-player download section | PR #4 → `ee32261` | Site content | `landing/components/download-section.tsx` |
| 0.2.17 release evidence checklist | PR #5 → `35146a0` | Process | `plugins/speakeasy/RELEASE-CHECKLIST.md` |
| Thread-locked voice conversations | PR #6 → `2fb45ff` + follow-ups | **After** v0.2.17 DMG | `ListeningSessionController`, `CodexThreadRouter`, feasibility doc |
| Conversation HUD polish | PR #7 | After 0.2.17 | `HUDView.swift` |
| Apple Speech cold-start + lane backgrounding | PR #8 | After 0.2.17 | `AppleSpeechFileTranscriber.swift`, Info.plist Speech key |
| First-run speech consent | PR #9 | After 0.2.17 | PR #9; Apple Speech path |
| Dedicated microphone picker | PR #10 → `ea38f51` / merge `0e99e7f` | After 0.2.17 | Popover mic menu; `ListeningInputPreference`; tests |

Earlier 2026 baseline (still product-relevant): multi-provider TTS (system/OpenAI/ElevenLabs/Groq/Gemini), SQLite cache, custom `TTSAdapter`, GitHub Pages landing + docs, macOS DMG install path, HUD history.

## Website / updates surface finding

| Surface | Path | Role | Blog/updates? |
| --- | --- | --- | --- |
| Marketing landing | `landing/` → speakeasy.arach.dev | Hero, download, features, legal | **No** blog/changelog route |
| Docs (landing-wired) | `docs/*.mdx` + `landing/lib/docs.ts` | Product docs | **No** updates feed |
| Fumadocs site | `docs-site/` | Alternate docs shell | **No** blog |
| Staged content (this work) | `docs/blog/` | Publication-ready draft for later | **Gap filled with static post** |

## Docs changed (this task)

- `docs/blog/2026-07-25-product-update.md` — publication-ready product update
- `docs/blog/INVENTORY-2026-07-25.md` — this inventory
- `docs/listening-mode.mdx` — user-facing listening mode + mic picker
- `docs/menu-bar-player.mdx` — user-facing menu-bar player
- `docs/menu-bar-player.md` — pointer to canonical mdx
- `docs/listening-mode-feasibility.md` — mic picker design section
- `docs/meta.json` — nav entries for macOS app docs
- `docs/index.mdx`, `docs/quickstart.mdx`, `docs/troubleshooting.mdx`
- `README.md` — product surfaces table

## Constraints honored

- Worktree: `/Users/arach/.codex/worktrees/befb/SpeakEasy` only
- No product code changes (no `src/`, no `app/Sources` edits)
- No commit, push, publish, or merge
