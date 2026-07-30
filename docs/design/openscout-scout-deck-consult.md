# Design consult: SpeakEasy HUD/Deck → OpenScout Scout Deck (iPad)

Prepared by `session-ms3g60t4-kg5zy5` for `openscout.codex-scout-deck-control-surface-final.air-local`
Ask ref: `f-ms3g63in-5lq1`

---

## 1. Best reference files & screenshots

Ranked by how much they transfer to an iPad-oriented, lane-centric deck.

| Rank | Reference | Why it matters |
|---|---|---|
| 1 | `app/Sources/SpeakEasy/HUDView.swift` — `HUDContent` (:265-359), `HUDTextSection` (:363-425), `HUDWaveformSection` (:450-534) | The strongest artifact in the repo. A 450×120 always-on-top glass slab that conveys *what is happening right now* with zero chrome. This is the closest thing SpeakEasy has to a "control pad." |
| 2 | `landing/public/hud-cropped.png` + `landing/public/hud-demo-final.mp4` | Shows the HUD in real context, floating over a working terminal. The video is the single best artifact for feeling the *cadence* — words landing at speech pace, bars breathing. |
| 3 | `app/Sources/SpeakEasy/SpeakEasyApp.swift` — `Theme` (:7-35), `glassBackground`/`glassCapsule`/`GlassIntensity` (:50-103), `FlatButtonStyle` (:107-153) | A tiny, disciplined token system: 7 semantic colors, 3 elevation levels, one 0.5px border everywhere. Worth copying wholesale as a method, not as values. |
| 4 | `app/Sources/SpeakEasy/SpeakEasyApp.swift` — `ContentView` (:448-629) + `landing/public/settings-dashboard.png` | Header / capsule tab rail / scrolling body / persistent action footer. Good bones for a tablet shell; see caveats in §4. |
| 5 | `app/Sources/SpeakEasy/HistoryView.swift` — `HistoryEntryRow` (:223-290) | The row/lane primitive: text first, metadata as small capsule badges, timestamp right-aligned and tertiary. Directly reusable as an agent-lane event row. |
| 6 | `landing/app/features/page.tsx` (:45-66) | The "live" affordance: a pulsing emerald dot in a frosted pill overlaid on a dark surface. Small pattern, high signal. |

---

## 2. Visual hierarchy & interaction patterns worth carrying over

**A. Three-tier text opacity is the whole hierarchy.**
`Theme.dark` (SpeakEasyApp.swift:16-24) defines `text` = 1.0, `textSecondary` = 0.65, `textTertiary` = 0.4 — all pure white at different alphas, over pure black. No second hue is used for hierarchy. On a large iPad canvas showing many lanes at once, this is exactly right: it lets you pack density without the screen becoming a color salad, and it keeps *color free* to mean status only.

**B. Elevation by alpha, not by shadow.**
`GlassIntensity` (SpeakEasyApp.swift:85-103) is three fill/border pairs: subtle 0.03/0.08, regular 0.05/0.12, prominent 0.08/0.16. Every surface in the app picks one. The result reads as a stack of glass plates with no drop shadows anywhere. This scales to a deck far better than shadow-based cards — 20 lanes with shadows is mud; 20 lanes at 0.03 fill is a legible grid.

**C. Motion is bound to real signal, never decorative.**
- The waveform bar height is driven by the actual audio level pushed over the pipe (`WaveformBar.height`, HUDView.swift:521-526), with a `sin(phaseOffset)` term only to de-synchronize neighbors so it reads organic. Idle state is a small non-zero baseline (:512), so "connected but quiet" ≠ "dead."
- Text reveals word-by-word at 4 words/sec to match speech pace (`HUDTextSection.startWordAnimation`, HUDView.swift:411-424), and the *most recent* word is heavier and brighter (`FlowingText`, :439-440).

Both are the same idea: **the animation is a data channel, and the leading edge is emphasized.** That's the most transferable thing in this repo for a live-agent deck.

**D. Attention decays on a timer, and can be dismissed.**
`HUDWindowManager` (HUDView.swift:20-88) shows on message, auto-hides after 3s, and — importantly — a level-only update refreshes the waveform *without* resetting the hide timer (:52-58). Activity keeps the surface alive; only new content re-arms attention. There's always a manual dismiss (:333-344).

**E. State is legible before it's actionable.**
The dashboard provider rows (`settings-dashboard.png`) lead with identity + one-line status ("Not configured" / "Voice ID: 2EiwWnXF…"), then a status glyph, then a chevron. Status is readable at a glance from across a desk; the affordance to act is secondary and to the right.

**F. Unsaved/dirty state is a persistent, non-modal capsule.**
`ContentView` (:489-502) puts a dot + "Unsaved" capsule in the header whenever config is dirty, with the commit action pinned in a footer bar (:560-613). Nothing blocks; the surface just tells you it owes you something.

**G. Keyboard/slot addressing.**
The HUD screenshot shows `⌘1` / `⌘2` slot chips flanking a truncated workspace path (`…/dev/SpeakEasy/app`). Sessions are *addressable by index*, and the identity shown is the truncated tail of a path, not a UUID.

---

## 3. What should stay SpeakEasy-specific

- **The audio waveform itself.** It's literal here (amplitude of speech). Porting the shape to OpenScout without an equivalently literal signal would be decoration. Port the *principle* (§2C), not the bars — unless you bind them to something real like token throughput or tool-call rate.
- **Word-by-word reveal at speech pace.** Only meaningful because it's synchronized to audio a human is hearing. Agent output has no such tempo.
- **The provider taxonomy and its tab rail** (Dashboard / OpenAI / ElevenLabs / System / Cache / HUD / History, SpeakEasyApp.swift:509). This is a settings IA, not a monitoring IA.
- **3-second auto-hide.** Correct for a transient overlay you glance at; wrong for a deck someone is watching. Keep the *decay* concept (§5.3) but not the disappearing act.
- **Pure black `#000` background.** Chosen for OLED-ish overlay contrast on macOS. iPad in a lit room, viewed for long stretches, wants ~`#0B0D10`–`#111` so the glass plates at 0.03 fill are actually distinguishable.
- **`min-width: 580` desktop window sizing and the mouse-hover states** (`surfaceHover`, FlatButtonStyle press states). Touch has no hover; that entire channel of feedback has to be re-earned with press/scale/haptics.

---

## 4. Traps in the reference worth not inheriting

1. **The capsule tab rail (SpeakEasyApp.swift:508-540) does not survive to iPad.** Seven capsules in a fixed row already crowds a 580pt window. A deck needs a persistent left rail (lanes/filters) with the deck itself as the constant right-hand surface — landscape iPad has the width for it, and tabbing away from live agents to reach a control is exactly the failure mode to avoid.
2. **`Text("Build: HUD-v2.0-\(Date().timeIntervalSince1970)")` (:578)** renders a raw float in the footer of a shipping screenshot. Cosmetic, but it's a good reminder: any debug affordance on a deck will be seen by everyone who looks at the screen.
3. **The landing site's light emerald/blue gradient language** (`landing/app/features/page.tsx:10-12, 34-36`) is marketing chrome and shares nothing with the product surface. Don't let a deck inherit a landing page's palette.

---

## 5. Five concrete recommendations for the OpenScout Scout Deck

### 5.1 — Make the lane the atomic unit, and give it a leading edge
Build one `LaneCard` primitive and let the deck be a grid of them. Structure it as the HUD is structured (HUDView.swift:308-345): **identity strip → live content → activity track**, with a dismiss/ack affordance top-right.

- Identity strip: slot chip (`⌘1`-style, but touch-addressable), truncated repo/workspace path, agent handle.
- Live content: the last utterance/tool-call, with the **most recent line at full opacity and heavier weight, prior lines decaying to 0.65 then 0.4** — the `FlowingText` treatment (:439-440) applied to log lines instead of words. This is the single highest-value port.
- Activity track: replace the audio waveform with a **thin per-lane sparkline of the last ~60s of events** (tool calls, tokens, turns — whatever you actually have). Keep the non-zero idle baseline from `WaveformBar` (:512) so idle-connected is visually distinct from disconnected.

### 5.2 — Reserve color exclusively for attention state; use alpha for everything else
Adopt the `Theme` + `GlassIntensity` method verbatim (SpeakEasyApp.swift:7-103) — 3 text alphas, 3 elevation levels, 0.5px borders, no shadows — but define an explicit, small attention scale that is the *only* thing allowed to be chromatic:

| State | Treatment |
|---|---|
| `idle` | glass at `subtle`, no accent |
| `working` | glass at `regular`, accent hairline on the leading edge, sparkline live |
| `waiting_on_you` | glass at `prominent` + solid accent left border + lane floats to top of deck |
| `blocked` / `failed` | accent border + a persistent, non-modal badge (the "Unsaved" capsule pattern, :489-502) |
| `done` | drops chroma entirely, decays to `subtle` over ~30s |

Because nothing else in the UI is colored, a single lane needing attention is visible peripherally, from across a room, on a propped-up iPad. That's the whole point of a deck.

### 5.3 — Decay attention, don't dismiss it; separate "activity" from "new content"
Port `HUDWindowManager`'s distinction directly (HUDView.swift:51-74): **a stream of activity keeps a lane visibly alive but must not re-arm attention; only a new state transition (waiting / blocked / review_requested / done) does.** Without this, a chatty agent monopolizes the deck and a stuck agent goes unnoticed — the exact inversion of what you want.

Instead of the 3s auto-hide, let attention *fade*: a lane that transitioned 10 seconds ago is brighter than one that transitioned 5 minutes ago. Sort or badge by attention-age, and make "ack" an explicit touch that returns the lane to baseline. The dismiss button (:333-344) becomes acknowledge.

### 5.4 — Design the deck for glance-first, touch-second, and give touch its own feedback channel
The deck's primary mode is *ambient*: propped up, watched, not touched. So:
- Every lane must be fully legible with **zero interaction** — no hover, no tooltip, no expand-to-understand. The provider-row pattern (§2E) is the model: identity + one-line status carries the meaning.
- Touch targets ≥ 44pt; the `FlatButtonStyle` scale-to-0.97 + opacity press feedback (:125-127) is a good touch idiom already — keep it, add haptics, and delete every `surfaceHover` dependency.
- Support a **two-finger / long-press drill-in** from any lane straight to its transcript, and make swipe the ack gesture. Never make the user leave the deck to act on a lane.

### 5.5 — Add the one thing SpeakEasy has no equivalent for: cross-lane coordination
This is where the deck must diverge from every reference above, because SpeakEasy's HUD only ever shows one thing at a time. Suggestions, in order of value:

1. **A shared time axis.** Align every lane's sparkline to the *same* wall-clock window, so vertical scanning shows what happened simultaneously across agents. This is the cheapest possible correlation tool and it comes free once §5.1 exists.
2. **Handoff as a visible edge.** When lane A hands off to lane B, draw it — a brief connector, or at minimum a matching ref-badge on both lanes. The collaboration contract already models `handoff` / `waiting` / `review_requested` as first-class verbs; the deck should be the place where that graph is *seen*, not inferred from two separate logs.
3. **An attention queue rail.** A narrow persistent column listing only lanes in `waiting_on_you` / `blocked` / `review_requested`, oldest-first, with the owner of the next move named explicitly. The deck answers "what's running"; the rail answers "what needs me" — and those are different questions that should not share a visual channel.

---

## Summary

Port from SpeakEasy: **the token system** (3 text alphas / 3 glass elevations / 0.5px borders / no shadows), **the leading-edge emphasis** on live content, **the activity-vs-attention split** in the HUD manager, and **the row primitive** from `HistoryEntryRow`.

Leave behind: the waveform, the speech-paced reveal, the capsule tab rail, the 3s auto-hide, pure `#000`, and every hover-dependent state.

Invent fresh: shared time axis, visible handoff edges, and an attention queue — none of which have any precedent in this repo, and all of which are what make a deck a *coordination* surface rather than a prettier log viewer.
