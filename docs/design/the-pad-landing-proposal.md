# THE PAD — landing page proposal

Status: shipped — the mock is now the live `/codex` page
Date: 2026-08-08
Companion mock: `landing/mocks/pad.html` (rendered by `landing/app/codex/page.tsx`)

---

## 1. Point of view

The current `/codex` page sells a *routing contract*. It is a good SaaS page:
badges, cards, a stepper, a feature triptych. That is exactly the wrong shape
for THE PAD. THE PAD is an object. Nobody buys a Stream Deck because of a
routing contract — they buy it because the keys look like they would feel good
under a thumb, and then they discover it does real work.

So the proposal is: **sell the instrument first, let the architecture be the
fine print that rewards a closer read.** Teenage Engineering does not lead with
the OP-1's signal path. They show the object, label it beautifully, and let
you want to touch it. The trust copy ("no shadow conversation", "fail closed")
is real and differentiated — but it plays the role of the spec plate on the
back of the unit, not the headline.

One-sentence positioning for the page:

> **You already run several Codex tasks at once. THE PAD is a pad you can
> talk to any one of them with, and hear the reply, without going back to
> the laptop.**

**Copy voice.** The visual design can be aspirational; the writing should not
be. Plain sentences, concrete nouns, no absolutes that aren't literally true,
no telling the reader how to feel. If a skeptical engineer read a line out
loud, it should still hold up.

## 2. Visual direction

**Theme: `flight`, full-bleed.** Dark graphite (`#0B0E10`), panels one step up
(`#12161A`), hairline borders (`#1E2429`), a single mint signal color
(`#6FE3B4`), one amber reserved for recording state, one red reserved for
STOP. This is where the product is heading and it is the only theme that
makes a browser-rendered surface read as hardware. Paper/porcelain appear
only in the themes strip near the bottom, as proof the surface is skinnable.

**Typography, two voices only:**

- *Display* — a neutral grotesk at very large sizes, tight tracking, light
  weight. Headlines are short and literal: "What the controls do."
- *Instrument mono* — uppercase, letterspaced, 10–11px. This is the voice of
  the hardware: keycap legends, engraved labels, spec plates, status
  readouts. It does 80% of the talking. The discipline from TE/Keychron pages
  is that labels are *small, precise, and everywhere* — `LN 3`, `RPLY`,
  `HOLD TO SPEAK`, `PARAKEET · ON DEVICE`, `UNIT 001`.

**The rendering trick:** the instrument is drawn in HTML/CSS, not a screenshot.
Recessed pad faces with a top highlight and a bottom shadow (keycap dish), a
1px inner bezel, corner screws, LED dots with real glow, a knurled encoder.
On scroll, the hero unit tilts a few degrees toward the viewer like product
photography on a plinth. Every pad shows a *real-looking lane* — project,
branch, last exchange, state — so the grid reads as a mixer mid-session, not
an empty template.

**Explicitly avoided:** gradient blobs, glassmorphism cards, icon triptychs,
fake dashboards with charts, screenshots of Codex Desktop, any photo of a
smiling person holding an iPad.

## 3. Page structure

Eleven sections. Order is deliberate: object → desire → proof → mechanics →
honesty → install.

### 0. Nav — instrument, not site
Hairline bar. Left: `SPEAKEASY` wordmark + `THE PAD` in mono. Right, mono
links: `SURFACE` `LANES` `SPEECH` `THEMES` `INSTALL`. Far right a single LED
dot + `MAC LIVE`. No "Sign in", no "Get started" button in the nav — the
whole page is the CTA.

### 1. Hero — the object on a plinth
Full viewport, graphite. The 9-pad surface rendered large and slightly
off-center, on a subtle floor shadow, with slow idle motion (one LED breathes,
a waveform on the active lane animates). Micro-typography floats around the
unit like museum placard text: `MODEL SE-1`, `9 LANES · PARAKEET ASR`,
`GRAPHITE / MINT`.

Headline (left or above, grotesk, light):

> **A pad for the Codex tasks**
> **you're already running.**

Subhead (two sentences, muted):

> It runs on an iPad as a web app, with nine lanes — one Codex task each.
> Hold the bar to talk to a lane, and the reply gets read back to you.

Two CTAs, styled as transport keys, not marketing buttons: a solid mint key
`▶ ADD TO HOME SCREEN` and an outlined key `HOW IT WORKS ↓`.

### 2. The argument — one line, full width
No cards. A single large typographic block, grotesk, that carries the
positioning:

> Every running task gets its own key.
> All nine on one screen.

Small mono follow-up: `ONE LANE PER TASK — NINE ON THE PAD, TWELVE ON THE MICRO DECK.`

### 3. Lanes — the mixer metaphor, proven
A blown-up close-up of **one pad** (CSS, ~3x scale) showing everything a lane
carries: lane number, project `speakeasy`, branch `codex/native-ipad-deck`,
last exchange truncated, state LED (`IDLE` / `LIVE` / `QUEUED`). Beside it,
tight copy:

> **Each key holds a task, not a macro.**
> Each of the nine keys is bound to one exact Codex task, and shows the
> project, the branch, the last exchange, and whether that task is live, idle,
> or queued. Routing is by task ID, so nothing depends on which window is
> focused or what the most recent thread is called.

Then a second close-up: the **Micro Deck** 4×4 key bank, one paragraph: same
binding model, denser grid, bottom row is transport, so twelve lanes.

### 4. HOLD TO SPEAK — the big bar
A section that is mostly the bar itself, full-bleed, mint, with the legend
engraved: `HOLD TO SPEAK — PARAKEET · ON DEVICE`. Copy above it, short:

> **The transcription happens on the iPad.**
> Hold the bar and talk. Parakeet runs on the device through Core ML, so the
> audio isn't uploaded anywhere and there's no speech server in the path. Let
> go and the transcript is sent once, to the task bound to that lane.

A mono spec line under the bar: `TRANSCRIPTION: ON-DEVICE · ROUTING: EXACT TASK ID · DELIVERY: EXACTLY ONCE`.

### 5. Anatomy — the annotated diagram
The centerpiece for the Stream Deck / Loupedeck audience. The full surface,
flat-on, with numbered callout lines radiating to labels:

1. `ENCODER — narration volume; press to pause`
2. `SPEAKER GRILLE — status voice, not playback`
3. `STATUS LEDS — bridge, mic, queue`
4. `LANE PADS ×9 — one exact Codex task each`
5. `TRANSPORT — REPLAY / STOP / AUTO / ACTIVITY`
6. `HOLD TO SPEAK — momentary, on-device ASR`

Left column copy headline: `What the controls do.` The section is a labeled
diagram, so the headline should just say that.

### 6. One turn — the signal path
The current page's 5-step loop, re-rendered as a horizontal signal chain,
mono boxes joined by hairlines, like a patch diagram:

`HOLD` → `TRANSCRIBE (on device)` → `ROUTE (task ID)` → `CODEX REPLIES` → `NARRATE`

Under it, three mono spec lines (the trust pillars, stated as facts rather
than slogans):

- `SAME CONVERSATION — dictation and reply stay in the same task.`
- `ROUTED BY TASK ID — not title, recency, folder, or focus.`
- `DURABLE QUEUE — on disk, survives relaunch, delivers once.`

### 7. The player — hear it back
Dark panel with the narration player drawn in CSS: scrubber, waveform, `0:18`,
`1.25×`, volume. Copy:

> **Answers come back as audio you can scrub.**
> Scrub the reply, change the speed, replay the last exchange, or turn on AUTO
> to have completions narrated as tasks finish. The full text is still in
> Codex; this is for when you'd rather listen than read.

### 8. Themes — the swatch strip
Five horizontal swatches, each a tiny live-rendered pad: `PAPER` (warm cream),
`FLIGHT` (graphite/mint, marked `SHOWN`), `OBSIDIAN`, `EMBER`, `PORCELAIN`.
One line: `Five themes, same layout.` Clicking a
swatch re-themes the whole page (cheap: one class on `<html>`, all colors via
custom properties). This is the page's one party trick and it sells the theme
system better than any copy.

### 9. Honesty — the spec plate
A framed plate, engraved aesthetic, that handles the constraint without
apology:

> **HOW YOU INSTALL IT**
> THE PAD runs as a PWA. Run `speakeasy deck` on your Mac, scan the QR code
> with your iPad, Add to Home Screen. It pairs over your local network and
> behaves like an app — full screen, no browser chrome.
>
> The native iPadOS app is in **developer preview** and is not on the App
> Store. The PWA is what you install today.

Plus the Codex-boundary line from GTM, verbatim in spirit: the bridge uses
private, version-checked Codex Desktop IPC and fails closed; it is not a
supported public Codex API.

### 10. Install — the final key
Centered: the mint `▶ ADD TO HOME SCREEN` key again, the `speakeasy deck`
command in a mono chip with a copy affordance, and the three-step mono list:
`RUN COMMAND → SCAN QR → ADD TO HOME SCREEN`. Footer below, hairline, quiet.

## 4. Why this order

Sections 1–2 create want before explanation (Stream Deck, TE, Keychron all do
this — the object carries the first viewport alone). Sections 3–5 prove the
mixer metaphor is real and the controls are legible. Sections 6–7 answer "but
is it a toy?" with the routing contract and the player. Sections 8–10 convert:
skinnable, honestly distributed, one command away. The trust copy moves from
headlines (current page) to engraved spec lines — present everywhere, loud
nowhere.

## 5. Implementation notes (Next.js + Tailwind + shadcn)

- Route: replace `landing/app/codex/page.tsx` only if THE PAD is meant to own
  `/codex`; cleaner is `/pad` (or `/codex/pad`) so the routing-contract page
  stays as the docs-adjacent deep link. Decision needed; the mock is
  route-agnostic.
- All theming through CSS custom properties (`--pad-bg`, `--pad-panel`,
  `--pad-mint`, `--pad-amber`, `--pad-red`) so the themes strip is a class
  swap — mirrors the deck's `--se-*` token layer (`docs/design/deck-design-layers.md`).
- The instrument is one self-contained component (`PadSurface`) parameterized
  by `lanes[]` and `scale`; reused at 1x (hero), 3x (lane close-up crop),
  flat (anatomy). No images required, though a real photo shoot of the iPad
  on a stand could eventually replace the hero render.
- Motion: CSS keyframes only (LED breathe, waveform shimmer, hero tilt on
  scroll via `transform` + intersection observer), `prefers-reduced-motion`
  collapses all of it.
- No new dependencies. shadcn `Button` is bypassed in favor of a `KeyCap`
  component — the transport-key CTA is the page's signature and worth the
  divergence.

## 6. Open questions

1. Route: `/pad` vs replacing `/codex`.
2. Hero render vs commissioning one real photograph of the PWA on an iPad in
   flight theme — the CSS render ships now, photo upgrades later.
3. Whether Micro Deck appears at launch or is held for a "soon" label; the
   mock shows it without promising dates.
