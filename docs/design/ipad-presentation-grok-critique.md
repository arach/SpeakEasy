# Design Critique: SpeakEasy Pad as Implementation Hero

**Role:** Senior product / visual designer
**Artifacts:** `landing/public/implementation/pad-console.webp` · `landing/components/codex-implementation-proof.tsx`
**Constraint:** Keep the real iPad Pad as hero. Preserve the real UI (not concept art). Do not redesign Pad implementation unless clearly warranted.
**Date:** 2026-07-29

---

## Executive read

The product capture is strong. Console-in-recording is the right moment: lane 02 armed, waveform live, **Release to send** as the only large CTA. That is a complete story in one frame.

The website presentation is currently **proving authenticity harder than it is selling presence**. Nested chrome, repeated “this is real” signals, and competing type scales make the Pad feel like evidence in a case file rather than a product you want to hold.

**Goal of the polish pass:** one quiet stage, one dominant instrument, one sentence of meaning. Everything else supports or exits.

---

## What already works (protect these)

| Asset | Why it works |
|-------|----------------|
| Capture moment | Mid-turn recording is more persuasive than idle chrome |
| Lane 02 highlight | Immediate spatial story: grid → selected channel → active task |
| Emerald-on-void palette | Distinctive, calm, “pro audio / flight glass” without neon cheapness |
| Real UI density | Operator credibility; do not fake a cleaner concept |
| Section thesis | “The iPad is the conversation surface” is the right headline |

---

## Prioritized critique

Priority scale: **P0** blocks “materially better” · **P1** large quality lift · **P2** refinement

### 1. Composition — P0

**Problem**
The section stacks five vertical bands before the eye rests on the Pad:

1. Section eyebrow + H2 + body
2. Dark stage chrome header (SpeakEasy Pad · Source-rendered)
3. Six layout tabs
4. Layout title + detail copy
5. Image + mono footer

Then more: 4-up flow cards, then Mac companion dual card. The Pad never gets uncontested vertical dominance.

**Inside the capture**
Composition is intentional and good: left rail (lanes) / center stage (task + waveform + hold control) / sparse bottom transport. Empty dark field is correct—it is negative space around the speech act, not a layout bug. Do not crop out the left grid; it is the multi-agent thesis.

**Fix intent**
- Give the Pad ~60–70% of section visual weight.
- Collapse proof chrome above the image.
- Move layout switching into a quieter secondary control.
- Demote Mac companion to a thin supporting row, not a second hero.

### 2. Framing — P0

**Problem**
Double-bezel without device: outer `rounded-[2–2.5rem]` dark card + inner `rounded-[1.25–1.8rem]` black frame + `object-cover` on a full-bleed app screenshot. Result: “screenshot in a card in a card,” not “instrument on a desk.”

The capture is full-bleed app chrome already (its own header, footer, corner radii). Website radii fight product radii.

**Also**
`aspect-[4/3]` with `object-cover` on 1366×1024 is roughly correct, but any future capture size change will silently crop the bottom transport or top status—those bars are story-critical.

**Fix intent**
- Single frame only. Prefer a soft device suggestion (thin bezel + subtle perspective or soft shadow) over nested UI chrome.
- Use `object-contain` (or fixed native ratio) so no chrome is cropped.
- Optional: very slight `scale` + vignette so the app feels inset in a physical surface, not pasted.

### 3. Hierarchy — P0

**Problem**
Too many peers claiming “primary”:

| Element | Current weight | Correct weight |
|---------|----------------|----------------|
| Section H2 | Display XL | Primary (keep) |
| Layout mode H3 | Large white display | Secondary / optional |
| Tab row | High contrast pills | Tertiary control |
| Capture | Visually large but buried | Primary visual |
| “Source-rendered” chip | Eye magnet | Remove or footer |
| Mono captions (×3–4) | Constant noise | One line max |
| Flow 01–04 | Equal cards, post-hero | Secondary narrative |
| Mac dual panel | Near-hero scale | Supporting footnote |

**Copy hierarchy collision**
Section says “conversation surface.” Mode title says “whole conversation at a glance.” Detail re-explains lanes + speech. Capture already shows it. Three verbalizations of one idea.

**Fix intent**
One title. One optional subtitle. Image. One quiet caption. Then optional flow. Kill parallel headlines inside the stage.

### 4. Storytelling overlays — P1

**Problem**
Story is told with **labels about the screenshot**, not **annotations on the moment**. Users must reverse-engineer:

- Which control is the deliberate act? (Release to send — obvious in UI, unannotated on site)
- What is Mac vs Pad authority? (footer “ALL COMMANDS ACKNOWLEDGED BY MAC” — tiny in capture; site explains later in prose)
- Why nine lanes? (left grid — site explains in mode copy above, not at the grid)

**What not to do**
Heavy callout boxes, numbered badges all over the glass, animated fake cursors. That reads as concept mock, not implementation.

**What to do**
At most **two** sparse overlays, outside or on the margin of the image:

1. **Left:** “9 durable lanes” pointing to the grid
2. **Center-bottom:** “Hold → Mac records → exact task” pointing near Release to send

Or replace overlays with the existing 4-step flow **only if** it is visually tethered (horizontal under the Pad, connected by a thin progress line), not a separate card grid that restarts the eye.

**Remove as storytelling**
- Commit hash in eyebrow (`6ff1d58`) — engineering diary, not product story
- “Interactive demo transport” in stage header — confuses “real product” with “demo mode”
- “Build truth” legal-ish disclaimer block — keep one short footnote, not a badge + paragraph

### 5. Typography — P1

**Problem**
Micro-mono overload: `text-[8px]`, `text-[9px]`, `text-[10px]` with `tracking-[0.16–0.22em]` appears in:

- Section eyebrow
- Stage subtitle
- Tab eyebrows
- Layout mono label
- Image footer (two spans)
- Flow step numbers
- Mac figcaption
- Soft badge

At marketing distance this becomes a **gray hash**, not craft. The display faces (`font-display` extralight) are elegant; the mono micro-labels are competing for the same “precision” job.

**Inside the capture**
Pad type is already a complete type system (display for Hudson, mono for status, bold for Release to send). Website type should **frame** it, not echo another full system on top.

**Fix intent**
- Reserve mono for **one** proof line (e.g. “Real Pad UI · Console · recording”).
- Section eyebrow: one line, no commit.
- Mode tabs: label only; drop per-tab eyebrows (“Recommended”, “Focus”…).
- Body: 15–16px / relaxed; avoid 12px light gray paragraphs next to XL display.

### 6. Color & light — P1

**Problem**
Light page (`#f6f7f5`) → abrupt black stage → white flow cards → black Mac column. The Pad’s emerald glass wants a **continuous dark field**, not a flash of night between two day surfaces.

Glow (`from-emerald-300/20 via-cyan… blur-3xl`) is soft but sits under a busy header, so it reads as ambient noise, not spotlight.

Active tabs use **light emerald fills** (`bg-emerald-50`) on a **near-black stage**—correct for accessibility, slightly “Material chip on OLED.” Prefer dark-selected states with emerald border/glow so the stage stays nocturnal and the Pad remains the only bright instrument.

**Capture light**
Already excellent: single accent family, low fill, glow on armed lane and CTA. Do not recolor the screenshot. Website should borrow **void + one accent**, not invent a second palette.

**Fix intent**
- Stage: deeper void, single radial light behind the Pad center (waveform region).
- Tabs: dark selected (`bg-white/10 border-emerald-400/40 text-white`).
- Flow cards: either dark-on-dark glass or very quiet light cards with less shadow.
- Avoid emerald text on both light section header and dark stage in equal strength—pick one hero accent zone (the stage).

### 7. Details to remove — P0/P1

**Remove now (high confidence)**

| Detail | Why |
|--------|-----|
| Commit hash in eyebrow | Dates the proof; no user value |
| “Source-rendered on July 29” pill | Redundant with “actual implementation” |
| Stage header dual-line mono (“real browser build · iPad landscape · interactive demo transport”) | Competes with product’s own top bar |
| Per-mode eyebrows on tabs (Recommended / Focus / …) | Extra decision noise; tabs are already labels |
| Dual mono footer under image (`1366 × 1024` + `pad/src · TypeScript…`) | Spec sheet energy |
| Inner image hairline gradient + heavy `shadow-2xl` stack | Decorative chrome on chrome |
| “Build truth” badge + long branch disclaimer | Move to one footnote or docs link only |
| Layout H3 + detail **and** section H2 + body saying the same thing | Pick one layer |

**Keep / quiet**

| Detail | Treatment |
|--------|-----------|
| Six layout modes | Keep; quieter tabs under or beside image |
| Four-step flow | Keep; tighter, maybe horizontal rail |
| Mac companion | Keep; half size, no black full column hero |
| Check / live affordance | One small “Live capture” or omit |

**Do not remove from the capture itself**
Footer transport, lane names, recording chrome, demo footer strip—those are product truth. Cropping them to “simplify” would be a Pad redesign by presentation, which is out of scope.

---

## Three concrete visual directions

### Direction A — “Museum plinth” (recommended)

**Metaphor:** One object on a dark plinth in a quiet gallery.

- Light section header stays brief.
- Full-bleed dark stage (less nested radius).
- Pad image is the only bright rectangle; soft elliptical light under center.
- Tabs as a minimal segmented control **below** the image (or left edge vertical).
- No mode title block above image; active mode name lives in the tab or a single caption.
- Flow as four thin steps under the stage, same max-width as the Pad.
- Mac as a small secondary strip.

**Why this wins:** Maximum respect for the real UI. Fastest path to “materially better” with mostly CSS/structure edits in `codex-implementation-proof.tsx`. Zero Pad app changes.

### Direction B — “Device in hand”

**Metaphor:** Editorial product shot.

- CSS or SVG iPad-ish bezel (thin, dark titanium), landscape.
- Slight 3D tilt (`perspective` + `rotateX/Y` very subtle) and soft contact shadow.
- Status overlays float **outside** the bezel, not on the glass.
- Light or gradient page background so the device is a physical object.

**Risk:** Bezel that is “almost iPad” can feel fake next to “not concept art.” Only use if bezel is abstract (radius + thickness), not Apple mimicry with camera hardware.

### Direction C — “Operator HUD frame”

**Metaphor:** Site chrome becomes a second instrument cluster around the capture.

- Corner brackets, scanline-thin rules, single live telemetry row.
- Annotations as HUD callouts with hairline leaders.
- Dark page section entirely (break from light marketing).

**Risk:** Stacks UI system on UI system. Easy to over-design. Best later if brand leans hard flight-deck everywhere.

---

## Recommendation

**Ship Direction A — Museum plinth.**

It keeps the real Console capture as the undisputed hero, removes authenticity theater, and only changes the website presentation component. Directions B/C can be experiments after A lands.

---

## Exact code-level changes (`codex-implementation-proof.tsx`)

File: `landing/components/codex-implementation-proof.tsx`
No changes to Pad app source. No new captures required for A (optional recapture only if you later want `object-contain` pixel-perfect padding).

### A1. Section header — strip and focus

**Current (lines ~110–122):** eyebrow includes `6ff1d58`; H2 + long body in 2-col grid.

**Change to:**

```tsx
<div className="mx-auto max-w-4xl text-center lg:max-w-5xl">
  <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${palette.eyebrow}`}>
    Actual implementation
  </div>
  <h2 className="mt-4 font-display text-4xl font-extralight leading-[1.02] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
    The iPad is the conversation surface.
  </h2>
  <p className="mx-auto mt-5 max-w-2xl text-sm font-light leading-6 text-slate-600 sm:text-base sm:leading-7">
    Real SpeakEasy Pad. Pick a Codex lane, hold to talk, hear the same task answer. The Mac owns mic, lock, and narration.
  </p>
</div>
```

- Drop commit hash.
- Center for plinth symmetry (or keep left-aligned if page system is left-locked—either is fine if body is shorter).
- One short paragraph, not a second essay.

### A2. Stage shell — one surface, not a product window

**Current (lines ~124–139):** dark card + header bar + “Source-rendered” chip.

**Change:**

- Remove the entire top bar block (lines 127–139).
- Keep outer shell but simplify:

```tsx
<div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-slate-900/80 bg-[#050708] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)] sm:rounded-[2rem]">
  {/* Single soft spotlight behind the Pad, not a top wash */}
  <div
    className="pointer-events-none absolute left-1/2 top-[42%] h-[28rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl"
    aria-hidden
  />
  <div className="relative px-3 pb-5 pt-4 sm:px-6 sm:pb-7 sm:pt-5 lg:px-8">
    {/* image first, then tabs, then caption — see below */}
  </div>
</div>
```

- Delete `palette.glow` top gradient or keep only the centered radial above.
- Reduce outer radius slightly so it does not compete with screenshot corners.

### A3. Reorder: image → tabs → caption (hierarchy)

**Current order:** tabs → mode title/detail → image → mono footer.

**New order:**

1. **Image** (hero)
2. **Tabs** (mode switch)
3. **One caption line** (mode story)
4. Optional tiny proof mono

```tsx
{/* 1. Frame — single bezel */}
<div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
  <img
    key={activeMode.image}
    src={activeMode.image}
    alt={activeMode.alt}
    width={1366}
    height={1024}
    className="h-auto w-full object-contain"
  />
</div>

{/* 2. Tabs — quieter, under image */}
<div
  className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  role="tablist"
  aria-label="Implemented SpeakEasy Pad layouts"
>
  {padModes.map((mode) => {
    const isActive = mode.id === activeMode.id
    return (
      <button
        key={mode.id}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls="pad-layout-panel"
        onClick={() => setActiveModeId(mode.id)}
        className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 ${
          isActive
            ? "border-emerald-400/40 bg-white/10 text-white"
            : "border-transparent bg-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"
        }`}
      >
        {mode.label}
      </button>
    )
  })}
</div>

{/* 3. Caption — one story line, not H3 + paragraph */}
<p id="pad-layout-panel" role="tabpanel" className="mt-3 max-w-2xl text-sm font-light leading-6 text-slate-400">
  <span className="font-medium text-slate-200">{activeMode.label}.</span>{" "}
  {activeMode.detail}
</p>
```

**Data model cleanup for tabs:**

- Stop rendering `mode.eyebrow` in the tab UI (can leave in data for future).
- Optionally shorten `detail` strings to ≤110 characters so caption stays one breath.

**Delete:**

- Mode H3 block (lines 167–173)
- Image dual mono footer (lines 187–190)
- Inner `p-1` / `p-1.5` double frame and top hairline (lines 175–176)

### A4. Image treatment CSS

```tsx
// Prefer contain so bottom transport never crops
className="h-auto w-full object-contain"

// Optional depth (Direction A lite device feel without fake iPad hardware):
// wrap img:
// className on wrapper: "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_80px_-20px_rgba(0,0,0,0.9)]"
```

- Remove `aspect-[4/3]` if using `object-contain` with intrinsic 1366×1024—let the image define height.
- If CLS is a concern, set `style={{ aspectRatio: "1366 / 1024" }}` on the wrapper instead of forcing cover.

### A5. Tone tokens — dark-selected tabs

Update `toneStyles` active tab (both emerald and blue) for dark stage:

```ts
// emerald
activeTab: "border-emerald-400/40 bg-white/10 text-white shadow-none",
// blue
activeTab: "border-cyan-400/40 bg-white/10 text-white shadow-none",
```

Remove light `bg-emerald-50` active chips on dark stage (current lines 87, 95).

### A6. Flow row — secondary, tighter

**Current:** 4 white cards, heavy relative to stage.

**Change:**

```tsx
<div className="mx-auto mt-8 grid max-w-5xl gap-0 border-t border-slate-200 pt-8 sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
  {flow.map(({ icon: Icon, step, title, body }) => (
    <div key={step} className="flex gap-3 px-1 py-3 sm:flex-col sm:px-5 sm:py-0">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-slate-400">{step}</span>
        <Icon className={`h-3.5 w-3.5 ${palette.eyebrow}`} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-xs font-light leading-5 text-slate-500">{body}</p>
      </div>
    </div>
  ))}
</div>
```

- No individual card borders/shadows.
- Reads as one process under the instrument.

### A7. Mac companion — demote

**Current:** large black column + 200px popover + dual essay.

**Change structure:**

```tsx
<div className="mx-auto mt-8 flex max-w-5xl flex-col items-start gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
  <img
    src="/implementation/popover-redesign.png"
    alt="SpeakEasy Mac menu bar popover"
    width={320}
    height={765}
    className="h-auto w-[96px] rounded-lg shadow-lg sm:w-[112px]"
  />
  <div className="min-w-0 flex-1">
    <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.eyebrow}`}>
      Mac companion
    </div>
    <p className="mt-1 text-sm font-medium text-slate-900">
      The Pad is visible. The Mac is authoritative.
    </p>
    <p className="mt-1 max-w-xl text-xs font-light leading-5 text-slate-500">
      iPad chooses the lane and requests actions. Mac holds the task lock, mic, transcript, and narration.
    </p>
  </div>
  <Link href="/docs/listening-mode/" className="shrink-0 text-xs font-semibold text-slate-700 hover:text-slate-950">
    Implementation guide →
  </Link>
</div>
```

**Delete from this block:**

- Three mini file cards (`pad/src`, `SpeakEasy.app`, wire protocol)—move to docs
- “Build truth” badge paragraph—or collapse to:

```tsx
<p className="mt-2 text-[11px] text-slate-400">
  Capture uses the real Pad UI with local demo transport.
</p>
```

### A8. Optional overlay (only if caption feels weak)

If after A1–A7 the story still undersells, add **one** non-interactive annotation **outside** the image bottom edge—not painted on the webp:

```tsx
<div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 sm:block">
  <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-medium tracking-wide text-emerald-100/90 backdrop-blur">
    Hold to speak · Mac records · exact task lock
  </span>
</div>
```

Only on Console mode if you want surgical storytelling; hide for other modes or keep generic.

### A9. `padModes` copy trims (same file, data only)

Shorten titles/details so caption layer works without H3:

| id | title (optional, may unused) | detail (caption) |
|----|------------------------------|------------------|
| console | keep or drop | “Nine voice lanes beside the live Codex task—lane 02 open for speech.” |
| cluster | | “Active task centered; all nine lanes stay on the lower edge.” |
| deck | | “Mixer-like strips for long-running tasks and speech controls.” |
| checklist | | “Assignments, locks, lease, and phase in one operator view.” |
| pfd | | “Quiet heads-up: task, link, narration, push-to-talk.” |
| micro | | “Same semantics, hardware-like control surface.” |

### A10. Out of scope (do not do in this pass)

- Redesigning Pad Console layout, type, or colors in `pad/src`
- Recolor or mock “cleaner” webp
- Fake device chrome with cameras/home indicator (Direction B later)
- Autoplay video of the session (nice future; not required for A)

---

## Implementation checklist (PR-sized)

1. [ ] Strip section eyebrow commit + shorten body
2. [ ] Remove stage header bar and source-rendered chip
3. [ ] Remove double image frame / hairline / aspect-cover
4. [ ] Image first; `object-contain`; single ring bezel
5. [ ] Tabs under image; label-only; dark selected state
6. [ ] One caption line; delete mode H3 block + mono footers
7. [ ] Centered soft emerald spotlight only
8. [ ] Flow as divider row, not four elevated cards
9. [ ] Mac strip demotion; drop file cards + build-truth badge
10. [ ] Visual QA at 375 / 768 / 1280: Pad still largest object; no crop of bottom transport
11. [ ] Spot-check both `tone="emerald"` (kimi) and `tone="blue"` (grok) consumers

---

## Success criteria

- In a 3-second glance, viewer sees **Pad UI recording**, not “documentation about a Pad.”
- Authenticity is implied by **pixel truth of the capture**, not by commit hashes and render dates.
- Layout switching still works; secondary.
- Mac remains present as supporting authority, never a second hero.
- No Pad product code changes.

---

## Summary decision

| Choice | Value |
|--------|--------|
| Direction | **A — Museum plinth** |
| Primary file | `landing/components/codex-implementation-proof.tsx` |
| Capture | Keep `pad-console.webp` as default hero mode |
| Pad app | No change |
| Biggest deletes | Stage header, mode H3, mono footers, build-truth block, light active tabs |
| Biggest moves | Image above tabs; flow + Mac demoted |

This is the shortest path from “likes it” to “materially better” without pretending the product is concept art.
