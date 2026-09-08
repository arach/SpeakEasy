# Deck — the lane detail panel

**Iterate on this; I'll judge.** Ship a diff, not a proposal.

Target file: `deck/ipad/Sources/NativeDeckView.swift` → `ActiveLaneInstrument`
(the `instrumentBody` path, ~line 1130 onward). Adjacent: `DeckLaneTrace.swift`.

## What this panel is

The right half of the Micro surface. It is the operator's view of **one lane** —
which Codex task it is, what came back, and what the audio is doing. Directly
below it is `DeckAudioInstrument`, a fixed one-rack-unit transport bar. That bar
owns the keys, the clock, and the settings. This panel owns the *content*.

Three bands, top to bottom:

1. **Identity** — `01` on a 46pt numeral gutter, project name, phase lamp,
   branch, session id chip.
2. **Exchange well** — labelled `LAST REPLY` / `TASK`, one recessed box.
3. **Trace** — `DeckLaneTrace`: the narration envelope + playhead + scrubber +
   the ≈ caption while speaking, a live capture figure while the mic is open, a
   seeded sparkline at rest.

Band 3 only just moved here, out of the transport bar. Bands 1–3 were each
designed on their own and have never been judged as one column.

## The two problems

### 1. The exchange well is a ~600pt box holding one line

This is the dominant object on the entire surface and it is empty. It is a
fixed `maxHeight: .infinity` frame with `lineLimit(6)` of 9pt type in it. In
practice a reply is one or two lines, so ~90% of the largest box on the deck is
blank plate.

The data to fill it is already on the device and nobody is reading it:

```swift
snapshot.threads[laneIndex]   // [DeckMessage], up to 50 per lane
struct DeckMessage {
    let role: String      // "you" | "agent"
    let text: String
    let dur: Double
    let file: String?     // non-nil ⇒ there is audio behind it
    let audioUrl: String?
}
```

The panel currently calls `lastAgentMessage(in:)` and throws the rest away. An
actual back-and-forth — what I said, what it said, scrolled, most recent
pinned in view — is the obvious thing that box wants to be. Whether it should
also be tappable (replay that specific message, not just the last one) is your
call to make and defend; `file != nil` is the condition under which a message
can be replayed.

Do not solve this by shrinking the box. The panel has the space; the box should
earn it.

### 2. The idle trace reads as a broken graph

At rest, `LaneSparkline` draws a seeded path at 0.18 amplitude across ~600pt.
On a lane that has never been active it is a flat line — which is precisely the
"graph that has stopped working" failure the rest of this instrument is built to
avoid. It looks fine on an active lane and wrong on an idle one, and lanes are
idle most of the time.

Either make the idle state something that is legibly *at rest* rather than
*failed*, or make the band not draw a figure it has no data for. A recessed
window with a line of type in it reads as a readout; an empty frame with a flat
line through it reads as a bug.

## Hard constraints

These are not preferences. A diff that breaks one of them gets rejected on
sight.

- **Crispness.** Structure comes from hard 1px edges at full strength. No
  gradient strokes — a border that fades from `lineSoft` to `line`-at-40% has a
  boundary that dissolves, and an edge that fades IS a blurry edge. Contact
  shadows ≤1.5pt radius or none. No black blur under a panel.
- **Light only where something is genuinely lit.** `accent` = live (mic open,
  loudspeaker moving). `amber` = working or backed up. Everything else sits in
  the ink ladder. Glow is not texture.
- **Tokens only.** `DeckPalette` / `DeckTheme`. No new hues, no hardcoded hex.
- **Both themes.** Flight (dark) and Ceramic (light/warm). Ceramic is the one I
  use and the one that exposes mistakes — a wash that reads as depth on black
  reads as haze on cream. Check both before you claim it works.
- **No duplicated facts.** The branch is on the identity line; do not repeat it.
  The clock and the transport controls belong to the bar below; do not grow a
  second set. The lane number appears once, in the gutter.
- **One height per state.** The bar below was just collapsed from two heights to
  one because a console that resizes when audio starts is the loudest possible
  way to say something quiet. Do not reintroduce that here — if a band grows
  when narration starts, it had better be paying for it out of a band that
  shrinks.

## How to work

```bash
cd deck/ipad
xcodegen generate     # only if you add a file
xcodebuild -project SpeakEasyDeck.xcodeproj -scheme SpeakEasyDeck \
  -destination 'generic/platform=iOS Simulator' build
```

Simulator `3A82FF50-AD4C-4510-A28F-BFE6CBA28A59` (iPad Pro 11" M5), bundle
`dev.arach.speakeasy.deck`. Note another agent shares that device and will steal
the foreground — verify your screenshot is actually the deck before reading it.

Theme is `@AppStorage(DeckThemeSelection.defaultsKey)`; write it with python3
`plistlib` (`plutil` cannot write dotted keys).

ASR is off on the simulator by design (`DeckVoice.asrEnabled`) — CoreML cannot
finish compiling Parakeet without an ANE, and every launch that tries leaves
compiled sub-graphs in `com.apple.e5rt.e5bundlecache`. That cache reached 14GB
before anyone noticed. Do not turn it back on.

## What to hand back

The diff, plus screenshots of both themes in at least: idle lane with a short
reply, idle lane that has never spoken, and a lane mid-narration. If you
couldn't reach a state, say so rather than describing what it would look like.
