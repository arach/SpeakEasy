# Lane detail panel — implementation handoff

Source of truth: `docs/design/deck-lane-panel-brief.md`.

## Diff (files)

| File | Change |
|------|--------|
| `deck/ipad/Sources/NativeDeckView.swift` | `ActiveLaneInstrument`: full exchange well, tap-to-replay, crisp chrome |
| `deck/ipad/Sources/DeckLaneTrace.swift` | Idle figure → `LaneIdleReadout` (no seeded flat sparkline) |
| `deck/ipad/Sources/DeckAudioInstrument.swift` | Preview call site updated (dropped unused `laneSeed`/`laneActive`) |

New helper: `LaneIdleReadout` in `NativeDeckView.swift` — recessed well, `AT REST` label, tokens only.

## Problem 1 — exchange well

**Was:** one `lastAgentMessage` line in a `maxHeight: .infinity` box.

**Now:**
- Passes `snapshot.threads[lane]` into the instrument.
- Label `TASK` when empty (title / bind prompt), `EXCHANGE` when there are turns.
- Scrollable YOU/AGENT turns, top-aligned when short; pin-to-latest on grow and while a turn is under the playhead.
- **Tappable replay:** rows with `file != nil` call `togglePlayback(lane:message:)`. Defended: the transport PLAY key still means *last in lane*; the well means *this turn*. Not a second clock or second transport set — only a target for the existing player. Left 1px accent rank while that turn is playing.

## Problem 2 — idle trace

**Was:** `LaneSparkline` at 0.18 amplitude — flat line reads as failed graph.

**Now:** fixed-height recessed readout with `AT REST` (ink4). Capture still draws a live figure; narration keeps envelope + scrubber + ≈ caption. Scrubber/caption growth is paid by the exchange well shrinking — panel height is constant.

## Constraints

- Hard 1px borders only; removed gradient stroke + soft glow on numeral/phase lamp/panel shadow.
- Tokens only (`DeckPalette`).
- Branch / clock / lane number not duplicated.
- Both themes screenshot below.

## Screenshots

All under `docs/design/lane-panel-shots/` (sim `3A82FF50-…`, SpeakEasy Deck frontmost verified):

| State | Ceramic | Flight |
|-------|---------|--------|
| Idle, short reply (lane 01) | `ceramic-idle-short-reply.png` | `flight-idle-short-reply.png` |
| Idle, never spoken (lane 02) | `ceramic-idle-never-spoken.png` | `flight-idle-never-spoken.png` |
| Mid-narration (playing `0:1`) | `ceramic-mid-narration.png` | `flight-mid-narration.png` |

## Decided against

1. **Shrinking the exchange well** — brief forbids it; space is earned by the transcript.
2. **Keeping seeded idle sparkline with a different amplitude** — still a graph with no data; readout is honest.
3. **Always-on scrubber/caption chrome at rest** — would invent a progress figure with nothing to measure; height trade only when narrating is allowed by “band that grows pays from a band that shrinks.”
4. **Label “LAST REPLY” for multi-turn** — wrong once the well is a conversation; `EXCHANGE` / `TASK` match the content.
5. **Replay on text-only turns** — no `file`, nothing for the runtime to play; no ghost control.
6. **Bottom-anchored short threads** — left a huge empty head under the label; top-align short, pin latest on overflow/speak.

## Build

```
xcodebuild -project SpeakEasyDeck.xcodeproj -scheme SpeakEasyDeck \
  -destination 'generic/platform=iOS Simulator' build
# ** BUILD SUCCEEDED **
```
