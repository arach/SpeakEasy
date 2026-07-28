# SpeakEasy pop-up redesign pass — 2026-07-26

Implementation record for [`speakeasy-popup-redesign-brief.md`](./speakeasy-popup-redesign-brief.md).

Before / after crops live in
[`references/redesign-2026-07-26/`](./references/redesign-2026-07-26/).

## What changed, and why

### One raised surface instead of four cards

The old pop-up stacked four sibling containers — conversation, now-playing,
controls, queue — each with the same 12pt radius, 0.5px outline and faint fill.
Nothing was subordinate to anything else, and the actual player (scrubber +
transport) floated *between* two of those cards with no container at all, so the
least-defined region on screen was the one the pop-up exists for.

The surface is now three zones with three different treatments:

| Zone | Treatment |
| --- | --- |
| Conversation / task state | flat on the pop-up background |
| Playback | the single raised well — now-playing, timeline, transport and output controls in one instrument |
| Queue + Settings/Quit | flat, separated by hairlines |

Grouping comes from tone and spacing. The only remaining outline in the pop-up is
the focus ring.

### Green means one thing

Mint was previously doing nine jobs: playing badge, lane chips, listening button,
play button, volume track, save checkmarks, cue speaker, autoplay, brand mark.
With everything accented, nothing was.

Reserved now for **active / selected / ready / progress**:

- play/pause fill — the one focal treatment in the pop-up
- playback progress fill
- the current lane chip (solid) and assigned lanes (ghosted)
- ready/playing status dots

Demoted to neutral chrome: the volume track (a level, not a state), the lane
save/reset actions, and the lane cue speaker. The **Lock task** button is
deliberately neutral — locking is an action, not a state.

The **Start listening** control was the subtlest problem: a second solid mint slab
competing head-on with play/pause. It is now mint-*tinted* when ready and solid
**red** only while recording, which is when it is genuinely live.

### Legible type

The old surface used ten sizes down to 7pt. The ramp is now five sizes with a
10pt floor (`PopoverType`), so no secondary text sits below what reads
comfortably in a menu-bar pop-up.

### A timeline that looks like a timeline

Two differently-sized native `Slider`s were replaced by one `PopoverScrubBar`
used for both position and volume. macOS sliders cannot be restyled, and their
oversized knobs read as unfinished chrome on a dark surface.

The replacement is a net accessibility gain, not a trade: drag, **arrow-key
seeking once focused** (±5s / ±5%), a visible focus ring, a VoiceOver adjustable
action, and knob transitions gated on `accessibilityReduceMotion`.

### Transport that is actually centred

The old row centred play/pause by padding an asymmetric five-slot cluster with an
invisible view. It is now three explicit zones — Stop on the leading edge as a
distinct utility, `⏮ ▶ ⏭` centred by construction, an equal-width trailing
balance slot — with comfortable 32/46pt hit targets.

### Controls, not a form

Volume, speed and autoplay were three icon-prefixed rows with a fixed 64pt
trailing column. Now two rows: volume on its own line, `Speed [1×]` and
`Autoplay [switch]` sharing the next. Same functionality, less form.

### Task lock, clarified

- The system `Picker` (light chrome + a heavy blue focus ring against near-black)
  became a drawn chip.
- **Lock task** is a full-width primary; Refresh dropped to an icon button, so the
  emphasis matches what the user is actually there to do.
- The error/recovery instruction is a rule-and-glyph callout instead of a filled
  amber box — parseable, and quieter than playback, per the brief.
- Per-lane voice and narration cue collapse behind a **Voice & cue** disclosure.
  They are optional overrides, not required state, and when an override exists the
  closed row still reports it ("· custom voice, custom cue"), so nothing is hidden.
- Lane chips only show a marker when a shortcut is *unavailable*. Decorating the
  healthy case put nine dots of noise on the strip.

### State coverage

Empty, idle, playing, paused, queued, listening, locked, unlocked and error are
all exercised by the snapshot matrix (below). Recording tints the whole
conversation zone rather than adding another bordered card.

## Changed files

| File | Change |
| --- | --- |
| `app/Sources/SpeakEasy/PopoverDesign.swift` | **new** — metrics, type ramp, tonal surfaces, hairline, callout, section label, button styles, `PopoverMenuChip`, `PopoverScrubBar`, `PopoverFormat` |
| `app/Sources/SpeakEasy/PlayerPopoverView.swift` | rewritten around the three-zone layout |
| `app/Sources/SpeakEasy/ListeningPopoverSection.swift` | rewritten: flat zone, drawn task chip, collapsed lane detail, consolidated shortcut status |
| `app/Sources/SpeakEasy/PlaybackEngine.swift` | `+ installSnapshotFixture(_:)` (DEBUG only) |
| `app/Sources/SpeakEasy/ListeningSessionController.swift` | `installLaneSnapshotFixture` takes a `SnapshotFixture` (DEBUG only) |
| `app/Sources/SpeakEasy/PlayerPopoverSnapshot.swift` | multi-state rendering via `--snapshot-states` |
| `app/Tests/SpeakEasyTests/PopoverDesignTests.swift` | **new** — 11 tests |

No player or listening protocol changed. `PlayerProtocol.swift`, `PlayerIPCServer.swift`
and the CLI/skill surface are untouched.

## Iterating on this surface

```bash
cd app && swift build
./.build/debug/SpeakEasy --snapshot-player /tmp/se --snapshot-states all
```

Renders `unlocked-idle`, `unlocked-error`, `locked-idle`, `locked-playing`,
`locked-queued`, `recording-idle`, `locked-failed`. A single state is
`--snapshot-states locked:playing` (`<listening fixture>:<playback fixture>`).

Before this pass the harness could render exactly one state, which is why the
idle/queued/failed compositions had drifted.

## Build and test

- `swift build` — clean, no warnings introduced
- `swift test` — 40 tests pass (11 new)
- `./build-app.sh` — signed bundle, launched and verified live

## One implementation note worth keeping

`.menuStyle(.borderlessButton)` hoists its own leading indicator and discards the
custom label's layout; `.menuIndicator(.hidden)` does **not** suppress it. Three
menus in this pop-up hit it. `PopoverMenuChip` works around it by drawing the chip
independently and overlaying the menu at `opacity(0.011)` purely for hit-testing
(`opacity(0)` would stop hit-testing). The menu keeps the accessibility identity;
the chip is marked `accessibilityHidden`.

## Proposed HudsonKit follow-up

Kept out of SpeakEasy's tree deliberately — SpeakEasy consumes
`hudsonkit-xcframework` 0.3.4 as a binary, so these are contributions to Hudson,
not a local coupling. Ranked by reuse:

1. **`HudScrubBar` / `HudLevelBar`** — the highest-value extraction. Any Hudson app
   with a dark surface hits the same wall: `Slider` is unstylable and its knob is
   wrong on a HUD. A tokenized slim track with drag, arrow-key stepping, focus
   ring, VoiceOver adjustable action and Reduce Motion handling would be reused by
   Talkie and Termini immediately. `PopoverScrubBar` is a working reference
   implementation.
2. **`HudMenuChip`** — the `borderlessButton` workaround above is not
   SpeakEasy-specific; it is a SwiftUI/AppKit fact every Hudson macOS app will hit.
   Owning it once in HudsonKit keeps the hack in a single place.
3. **`HudCallout`** — inline severity callout (rule + glyph + text) as a
   lower-weight alternative to a filled banner. HudsonUI has `HudBadge`,
   `HudEmptyState` and `HudCard`, but nothing for "say this clearly without
   shouting."
4. **Compact type ramp** — `HudFont` gives family and size but no named ramp for
   menu-bar density. Without one, each app invents its own (SpeakEasy had invented
   ten sizes down to 7pt). A `HudFont.compact` / `HudTypeRamp.menuBar` scale of
   13/12/11/10 would close that off.
5. **Tonal surface ladder + a lint** — `HudSurface` covers base/raised/chrome/inset/
   hover/press, but this pass still needed derived "ink at N%" tones for a well, an
   inset control and a hairline. Adding `HudSurface.well` / `.hairline` plus a lint
   that flags raw `Color.opacity()` in app code would prevent the magic numbers from
   growing back.
