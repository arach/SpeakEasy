# SpeakEasy pop-up redesign brief

## Objective

Give the native macOS menu-bar pop-up a focused visual-design pass. Keep it compact, dark, calm, and recognizably SpeakEasy, but improve hierarchy, spacing, legibility, and the relationship between listening, playback, and queue state.

Reference crop: [`references/speakeasy-popup-menu-2026-07-26.png`](references/speakeasy-popup-menu-2026-07-26.png)

## Current read

- The pop-up feels like several similarly weighted cards stacked together rather than one coherent player.
- The conversation lock workflow dominates the top but its labels, selector, refresh action, button, and warning compete for attention.
- “Nothing playing,” the timeline, transport controls, volume, speed, autoplay, and queue do not form a strong playback hierarchy.
- Secondary text is frequently too small or low-contrast.
- Repeated borders and containers create visual noise, while some areas still feel loose or under-composed.
- The bottom Settings and Quit actions read as a separate utility strip, but their alignment and emphasis could be more intentional.

## Direction

- No purple. Keep SpeakEasy’s restrained green accent and neutral near-black surfaces.
- Treat this as a native macOS menu-bar pop-up, not a miniature settings dashboard.
- Establish three clear zones: conversation/task state, current playback with controls, and queue/utility actions.
- Make the active or primary state obvious with one focal treatment; reserve green for active, selected, ready, or progress states.
- Reduce nested card chrome and repeated outlines. Use spacing, tonal surfaces, and typography to create grouping.
- Clarify the task-lock interaction and make the error/recovery instruction easier to parse without making it louder than playback.
- Make transport controls feel deliberate and balanced, with comfortable hit targets and an unmistakable primary play/pause action.
- Keep volume, playback speed, and autoplay accessible without letting controls become a dense form.
- Handle empty, idle, playing, paused, queued, listening, locked, and error states gracefully.
- Preserve or improve VoiceOver labels, keyboard behavior, focus visibility, contrast, and Reduce Motion behavior.

## Implementation scope

- Primary surface: `app/Sources/SpeakEasy/PlayerPopoverView.swift`
- Conversation section: `app/Sources/SpeakEasy/ListeningPopoverSection.swift`
- Supporting snapshots/tests as needed under `app/Sources/SpeakEasy` and `app/Tests/SpeakEasyTests`
- Prefer existing HudsonKit tokens and primitives. If a genuinely reusable primitive is missing, describe the HudsonKit contribution separately rather than coupling SpeakEasy to a local Hudson checkout.

## Working constraints

- Work in the current shared SpeakEasy worktree and preserve unrelated local edits.
- Do not introduce purple or generic glassmorphism.
- Do not remove functionality or hide required state.
- Avoid changing external player/listening protocols unless the design truly requires it.
- Iterate against a live signed app: inspect, implement, rebuild/relaunch, capture, critique, refine.

## Deliverable

Implement the design pass, provide before/after screenshots, summarize the visual rationale and changed files, and report build/test results plus any proposed HudsonKit follow-up.
