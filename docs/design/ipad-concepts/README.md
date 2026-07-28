# SpeakEasy iPad concepts

Generated with the built-in ImageGen tool on 2026-07-26. The concepts are 1448 × 1086 landscape mockups for an 11-inch or 13-inch iPad.

## Concept A — 3×3 lane pad

[`speakeasy-ipad-concept-3x3-lane-pad.png`](./speakeasy-ipad-concept-3x3-lane-pad.png)

The nine exact voice lanes are the entire product surface. Large numbered cards optimize recognition and muscle memory; the persistent lower strip holds listening state, push/toggle listening, transport, Mac handoff, and volume. This is the better direction when the iPad is treated mainly as a glanceable remote.

## Concept B — split active-lane workspace

[`speakeasy-ipad-concept-split-active-workspace.png`](./speakeasy-ipad-concept-split-active-workspace.png)

All nine lanes remain one tap away, while the focused workspace proves the exact-task model: lane identity, task title, cwd, provider, narration cue, recent response, live waveform, and “Open on Mac” share one clear context. The refinement replaces an ambiguous profile glyph with the lane number and explicitly labels the target as a Codex task.

## Concept C — aerospace console

[`speakeasy-ipad-concept-aerospace-console.png`](./speakeasy-ipad-concept-aerospace-console.png)

The split workspace is recast as a severe vehicle-and-mission-control surface: lanes become a numbered control bank, connection and listening state become telemetry, and **Hold to Speak** becomes the sole dominant action. Obsidian, ceramic white, cool cyan, hairline rules, and a safety-red Stop action replace friendly cards and broad accent fills. The direction borrows the discipline of elite automotive and aerospace interfaces without using company branding.

## Recommendation

Use the aerospace console as the primary visual direction, with the split view as its information architecture and the 3×3 concept’s denser landscape cards available in a collapsible **Pad** mode. It answers three questions without navigation: which exact task is active, what SpeakEasy is doing now, and what will happen when the user touches the microphone.

The visual system should stay restrained: deep neutral surfaces, ceramic white type, cool cyan only for connection/action/live states, safety red only for destructive actions, large touch targets, sparse chrome, and no generic macro-pad metaphor.

## Skin candidate — translucent control deck

The [OpenAI Supply Co. × Work Louder Codex Micro](https://openai.com/supply/co-lab/work-louder/) suggests a deliberately more tactile optional skin over the same information architecture:

- milky CNC-polycarbonate enclosure, inset key wells, PBT/PC keycap geometry, and visible corner fasteners;
- nine illuminated lane keys whose light communicates active, thinking, waiting, speaking, and done states;
- a wide 2U-style push-to-talk control;
- rotary playback volume or speech-speed control;
- a compact joystick/skill launcher and dedicated stop, replay, announce, and open-on-Mac keys;
- restrained neutral materials with status color appearing beneath translucent caps.

Treat this as a visual and interaction skin, not a fake product rendering or a separate navigation model. Lane order, exact-task context, connection semantics, and accessibility labels remain identical to the aerospace console.

## Opus 5 Studio exploration

The direction was expanded into six live, like-for-like web studies in OpenScout Studio:

- **Console** — the aerospace split workspace, tightened;
- **Cluster** — one circular focal instrument with a bottom lane bank;
- **Flight deck** — nine full-height channel strips;
- **Checklist** — tabular, diagnostic, and failure-oriented;
- **Glass PFD** — a flight-display field with connection and narration tapes;
- **Micro deck** — the translucent hardware skin with inset lane caps and a wide push-to-talk bar.

The study also exercises ready/recording/transcribing/narrating/failed phases, four link-health states, Safari versus Home Screen chrome, and landscape/portrait/Split View reflow.

Final recommendation: keep **Console** as the information architecture, bring in **Micro deck’s** inset cap, per-lane status light, depress-on-active feedback, and wide push-to-talk treatment without adopting the full light housing, and retain **Checklist** as a compact diagnostic mode. Do not pursue Cluster as the main surface.

Local study: `/Users/arach/dev/openscout/design/studio/views/speakeasy-pad.tsx`  
Report: `/Users/arach/dev/openscout/docs/eng/speakeasy-pad-studio-exploration.md`  
Screenshots: `/Users/arach/dev/openscout/design/studio/public/shots/speakeasy-pad/`
