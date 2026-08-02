# Final polish: Museum plinth (post-implementation)

**Artifacts:**
- Desktop and mobile renders from the local production export
- Code: `landing/components/codex-implementation-proof.tsx`

**Scope:** At most five material changes. No new directions. No Pad app redesign.

---

## Verdict

Direction A landed. The desktop section finally reads as **one instrument on a dark plinth**, not a case file. Hierarchy is mostly correct: title → Pad → quiet controls → process → Mac footnote.

What still holds it back is not concept—it is **scale on mobile**, **column rhythm under the plinth**, and **two leftover proof whispers**. Fix those and stop.

---

## What is already good (do not touch)

- Centered header + short body
- Image-first stage, dark selected tabs, no stage chrome bar
- Console capture still the right default moment
- Flow as a divider row (not four elevated cards)
- Mac demoted from second hero

---

## Five changes only

### 1. Must-fix — Fill the plinth (Pad scale, especially mobile)

**Observation**
Desktop: Pad is strong but still sits in a padded double frame (outer stage + `px-3` + inner `rounded-2xl`), so the glass never quite owns the black field.
Mobile: worse—the capture reads as a small floating device with empty dark margin; the hero loses authority at the exact viewport where scale matters most.

**Change** (stage + image wrapper only):

```tsx
{/* stage shell: keep outer radius/shadow */}
<div className="relative mt-10 overflow-hidden rounded-[1.5rem] border border-slate-900/80 bg-[#050708] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)] sm:mt-12 sm:rounded-[2rem]">
  {/* glow unchanged */}

  {/* less inset; mobile nearly edge-to-edge */}
  <div className="relative px-1.5 pb-4 pt-1.5 sm:px-4 sm:pb-6 sm:pt-4 lg:px-6 lg:pb-7">
    <div className="relative overflow-hidden rounded-[1.1rem] ring-1 ring-white/10 sm:rounded-2xl">
      <img
        ...
        className="h-auto w-full object-contain"
      />
    </div>
    {/* tabs + caption */}
  </div>
</div>
```

- Drop the heavy image `shadow-[0_24px_80px_…]`—the outer stage already casts the plinth shadow; inner shadow shrinks perceived size.
- Do **not** add device chrome. Just less air around the pixels.

**Success:** On a 390px viewport, Pad width ≈ section content width; waveform/CTA readable without pinch zoom.

---

### 2. Must-fix — One vertical column (full-section pacing)

**Observation**
Desktop render: plinth is nearly full `max-w-[86rem]`, then flow and Mac snap to `max-w-5xl`. The section **balloons then pinches**. Secondary content floats like footnotes under a billboard instead of continuing the same museum axis.

**Change:** Share one content measure for header, stage, flow, and Mac.

```tsx
<section ...>
  <div className="mx-auto max-w-6xl">  {/* was max-w-[86rem] */}
    {/* header already max-w-5xl centered — fine inside 6xl */}

    {/* stage: full width of this column (remove mental 86rem hero) */}
    <div className="relative mt-10 ...">...</div>

    {/* flow: drop max-w-5xl; inherit parent */}
    <div className="mt-8 grid gap-0 border-t border-slate-200 pt-8 sm:grid-cols-4 sm:divide-x sm:divide-slate-200">

    {/* Mac: drop max-w-5xl; inherit parent */}
    <div className="mt-8 flex ...">
```

Optional tighten: `mt-8` → `mt-7` between stage→flow and flow→Mac so the coda does not drift into a new section.

**Success:** One implied left/right edge from title through Mac strip; no wide-then-narrow accordion.

---

### 3. Must-fix — Delete residual “proof” captions

**Observation**
Still on screen:

- Stage: `Real Pad UI · local demo state`
- Mac: `Capture uses the real Pad UI with its local demo transport.`

Direction A’s job was to let the **pixels** prove reality. These two lines re-open the case file. Section body already says “Real SpeakEasy Pad.”

**Change:**

```tsx
{/* caption: detail only — no right-side proof line */}
<div id="pad-layout-panel" role="tabpanel" className="mt-3">
  <p className="max-w-2xl text-sm font-light leading-6 text-slate-400">
    <span className="font-medium text-slate-200">{activeMode.label}.</span>{" "}
    {activeMode.detail}
  </p>
</div>
```

And in the Mac strip, **delete** the `mt-2 text-[11px] text-slate-400` footnote entirely.

**Success:** Zero “demo transport / real UI” meta after the hero image.

---

### 4. Must-fix — Quiet the Mac strip (supporting, not closing statement)

**Observation**
After a correct Pad climax, the Mac block restarts with display `text-2xl` “The Pad is visible. The Mac is authoritative.” + guide link + tall popover. On desktop it is acceptable; as section **pacing** it steals the last beat. Mobile will stack it into a second poster.

**Change:**

```tsx
<div className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
  <img
    ...
    className="h-auto w-[72px] rounded-md shadow-md sm:w-[88px]"  /* was 96/112 */
  />
  <div className="min-w-0 flex-1">
    <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.eyebrow}`}>
      Mac companion
    </div>
    {/* was font-display text-2xl */}
    <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
      The Pad is visible. The Mac is authoritative.
    </p>
    <p className="mt-1 max-w-2xl text-xs font-light leading-5 text-slate-500">
      iPad chooses the lane and requests actions. Mac holds task lock, mic, and narration.
    </p>
  </div>
  <Link ... className="... text-xs ...">Implementation guide <ArrowUpRight ... /></Link>
</div>
```

- No `h3` display face.
- Smaller popover thumb.
- One body line (already shortened).
- Footnote already removed in #3.

**Success:** Mac reads as a caption-with-thumbnail, not a second chapter title.

---

### 5. Optional — Tabs + caption micro-hierarchy

Only if you still have budget after 1–4. Smaller lift than the must-fixes.

**A. Center the tab row on `sm+`** (museum axis; keep start-align + scroll on mobile):

```tsx
className="mt-4 flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center ..."
```

Slightly tighter chips: `px-2.5 py-1.5 text-[11px]` so six labels feel like a mode switcher, not a second nav.

**B. Stop repeating the tab label in the caption** when it is already selected:

```tsx
<p className="mt-3 text-center text-sm font-light leading-6 text-slate-400 sm:text-[0.9375rem]">
  {activeMode.detail}
</p>
```

Left-align on mobile if center feels odd under a horizontal scroll strip.

**C. Flow row weight (desktop only)**
Four columns look slightly under-typeset under a large plinth. Bump title to stay `text-sm` but body `text-xs` → keep; add `sm:px-4` only—or leave flow alone if #2 already fixes the orphan width. **Do not** re-cardify.

---

## Priority order to implement

| # | Priority | Theme | Effort |
|---|----------|--------|--------|
| 1 | **Must** | Pad fills plinth (mobile scale) | XS CSS |
| 2 | **Must** | Shared `max-w-6xl` column | XS CSS |
| 3 | **Must** | Delete proof captions | XS delete |
| 4 | **Must** | Mac strip demotion | S CSS/copy |
| 5 | Optional | Tabs center + caption de-dupe | XS |

Stop after four must-fixes if time is tight—the section will already feel finished.

---

## Explicit non-goals

- No Direction B bezel / tilt
- No Direction C HUD brackets
- No recapture of `pad-console.webp`
- No Pad product UI changes
- No restoring commit hashes, source-rendered chips, or build-truth blocks

---

## Acceptance glance (3 seconds)

| Viewport | Pass if |
|----------|---------|
| Desktop | One column edge; Pad is largest object; flow and Mac feel like the same object’s footnotes |
| Mobile | Pad nearly full width of plinth; tabs scroll; no second “poster” headline below |
| Both | No “demo transport / real UI” meta lines |

---

## Bottom line

Implementation is ~85% there. The ruthless remainder is **scale, alignment, silence, and demotion**—not new ideas. Ship must-fixes 1–4; treat 5 as optional seasoning.
