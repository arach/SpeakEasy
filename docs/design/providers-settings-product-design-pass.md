# SpeakEasy Providers Settings — Independent Product-Design Pass

**Date:** 2026-07-26  
**Scope:** Native Providers settings screen only (layout, hierarchy, density, no-purple palette → reusable HudsonKit primitives)  
**Code changes:** None (critique + recommended component/layout spec only)  
**Evidence:** Talkie captures  
- Fullscreen context: `Talkie Capture - 2026-07-26 14.05.27 … 647f38e5 t0ms.png`  
- Window focus: `Talkie Capture - 2026-07-26 14.05.45 - Window SpeakEasy - 1597x772 - 31a7d741 t0ms.png`  
**Current impl anchors:** `ProviderSettingsView.swift`, `ShellRootView.swift` (`HudAppManifest` tint `.violet`), `SpeakEasyApp.swift` (`OpenAIPlaygroundView`, `VoiceRow`), `PlayerPopoverView` mint accent

---

## 1. Executive critique

The screen has the right **information architecture bones** (rail → page → provider list → detail editor), but the **visual system fights itself**.

| Strength | Weakness |
|----------|----------|
| Clear master–detail split | Nested “Providers” hierarchy (rail + page title + `PROVIDERS` label) |
| Credentials elevated above voice | Purple/violet used as both brand accent and generic chrome tint |
| Status dots + DEFAULT badge convey state | State is hard to scan; selection and status compete |
| Voice list is legible as a radio group | Low contrast, weak selected surface, preview CTA is secondary |
| Playground exists as a real test path | Playground is demoted, clipped, and density-mismatched vs list |
| Dark HUD shell feels intentional | Large empty void under the 5-row provider list wastes width |

**Product read:** This is a *credential + voice configuration* tool, not a marketing gallery. Hierarchy should optimize for: **(1) which provider am I on**, **(2) is it ready**, **(3) which voice**, **(4) prove it with a preview**. Purple distracts from readiness (green) and from SpeakEasy’s already-shipped mint accent in the menu-bar player.

---

## 2. What the screenshots show (current layout map)

### 2.1 Shell chrome

```
┌ titlebar: traffic lights · SpeakEasy ──────────────────────────────────┐
├── rail (≈220) ─┬── page header ──────────────────────────────────────┤
│ SpeakEasy logo │  Providers                                          │
│ Dashboard      │  Credentials, voices, models, and previews          │
│ Providers ★    │                                                     │
│ Cache          │  ┌ list (260) ─┬ divider ┬ detail ────────────────┐ │
│ HUD            │  │ PROVIDERS   │         │ API Key card           │ │
│ History        │  │ OpenAI ★    │         │ Voice Selection card   │ │
│                │  │ ElevenLabs  │         │ Playground card (cut)  │ │
│ CLI path       │  │ Groq        │         │                        │ │
│                │  │ Gemini      │         │                        │ │
│                │  │ macOS       │         │                        │ │
├── status: SPEAKEASY · all changes saved ··· Reload · Save · PROVIDERS ┤
└────────────────────────────────────────────────────────────────────────┘
```

Approximate window in capture: **1597 × 772**. Content area feels ~half empty below the provider list; detail column is tall enough that Playground is partially out of fold.

### 2.2 Hierarchy problems (ranked)

1. **Triple “Providers” labeling**  
   Rail selection + page H1 + section label `PROVIDERS` all say the same thing. Section labels should name *the role of the column* only when it differs from the page (e.g. “All providers” is still weak; better: drop the label or use a count filter).

2. **Accent is generic violet, not product identity**  
   Selected rail, provider icon wells, DEFAULT badge, footer `PROVIDERS` chip, and API key icon all lean purple. The live player popover already uses mint. Settings feel like a different product.

3. **Provider list is icon-monochrome**  
   Every row uses the same violet icon treatment. Users scan by *word length and position*, not by color/shape memory. Offline (macOS) vs cloud providers are not visually tiered.

4. **Status is a 6–8px dot with no label in list**  
   Green/gray dots encode configured vs not, but DEFAULT is a filled purple pill. Configured + default should be one scannable trailing cluster (badge hierarchy), not a tiny traffic light competing with brand purple.

5. **Detail stack is three equal cards**  
   API Key / Voice Selection / Playground all share the same `HudCard` weight. Credential readiness should be a **compact top strip**; voice choice should be the **primary workspace**; playground should be a **sticky footer or collapsible tray**, not a third peer card fighting for height.

6. **Density mismatch**  
   - Provider rows: reasonably padded (good for 5 items).  
   - Voice rows: airy vertical padding + dual-line captions → 6 voices ≈ long list with weak selected surface.  
   - Playground: 60pt text editors inside padded cards → tall, then clipped.  
   Result: sparse left, crowded-but-muted right, empty center bottom.

7. **Selection language is inconsistent**  
   Rail: tinted ghost fill + accent icon.  
   Provider list: purple border/fill via `HudListRow`.  
   Voice row: checkmark.circle only (almost no fill).  
   Users get three different “selected” idioms on one screen.

8. **Footer actions feel bolted on**  
   `Reload` / `Save` / `PROVIDERS` sit in a global status bar. Save is correct globally, but `PROVIDERS` as a purple badge restates navigation. Prefer a neutral section indicator or drop it.

---

## 3. Design principles for the redesign

1. **One accent job.** Accent color = interactive selection + primary CTA only. Never recolor every icon well.
2. **Status is semantic, not brand.** Ready / not ready / default / error use fixed semantic colors independent of accent.
3. **Master is short; detail is deep.** Five providers should sit in a compact, full-height list with optional footer actions (Set default / Docs). Detail owns vertical scroll.
4. **Progressive disclosure.** Show model/instructions only when the provider supports them; don’t force equal card stacks.
5. **Preview is adjacent to choice.** Voice preview controls live on the row; full playground is secondary and never steals the first fold.
6. **No purple.** SpeakEasy product accent aligns with player mint/teal. Violet remains available in HudsonKit as an optional tint for *other* apps, not SpeakEasy chrome.

---

## 4. Recommended no-purple palette (HudsonKit-ready roles)

Map to roles, not one-off hex usage. Values below are **dark-theme working targets** (light theme mirrors via `HudTheme` later).

### 4.1 Surface roles

| Token | Role | Suggested dark value | Notes |
|-------|------|----------------------|-------|
| `surface.bg` | App canvas | `#0B0C0E` | Near-black, slight blue-gray |
| `surface.chrome` | Rail + titlebar + status | `#101214` | +1 step from bg |
| `surface.panel` | Page body behind cards | `#0E1012` | Optional; can = bg |
| `surface.card` | Elevated card fill | `#15181C` | Primary content surface |
| `surface.cardHover` | Hover lift | `#1A1E24` | Lists/rows |
| `surface.inset` | Fields, secret well, text editors | `#0A0C0F` | Inset controls |
| `surface.selected` | Selected row wash (accent-tinted) | `accent` @ 12% | Not full purple fill |
| `border.subtle` | Card edge | `#FFFFFF` @ 6% | Hairline |
| `border.strong` | Focused / selected edge | `#FFFFFF` @ 12% | Or accent @ 35% |
| `border.focus` | Keyboard focus ring | accent @ 55% | 2px outside |

### 4.2 Ink roles

| Token | Role | Suggested dark value |
|-------|------|----------------------|
| `ink.primary` | Titles, selected labels | `#F2F4F7` |
| `ink.secondary` | Body, row titles unselected | `#B8C0CC` |
| `ink.tertiary` | Captions, section labels | `#7A8494` |
| `ink.quaternary` | Placeholders, disabled | `#525A66` |
| `ink.onAccent` | Text on solid accent buttons | `#04120E` |

### 4.3 Accent (SpeakEasy product — no purple)

Align with menu-bar player mint already in code (`≈ rgb(0.36, 0.87, 0.66)`).

| Token | Role | Suggested value |
|-------|------|-----------------|
| `accent.primary` | Selection, primary CTA, focus | `#4FDEB0` (mint) |
| `accent.soft` | Ghost fills, soft icons | `#4FDEB0` @ 14% |
| `accent.muted` | Secondary links on dark | `#3CB892` |
| `accent.strong` | Pressed / emphasis | `#2FA87F` |

**HudsonKit mapping proposal**

- SpeakEasy `HudAppManifest.tint` → **`.teal`** (or new `.mint` if teal is too cool) — **not** `.violet`.
- Keep `HudTint.violet` / `.pink` for non-SpeakEasy products; do not hardcode them in shared settings primitives.

### 4.4 Semantic status (independent of accent)

| Token | Role | Suggested value | Usage |
|-------|------|-----------------|-------|
| `status.ok` | Configured / ready | `#3DDC97` | Dot, CONFIGURED badge |
| `status.warn` | Partial / unsaved | `#E0A84A` | Unsaved, missing optional |
| `status.error` | Invalid key / API fail | `#F07178` | Inline errors |
| `status.info` | Neutral info | `#6EB6FF` | “Get API Key” optional |
| `status.idle` | Not configured | `#4A5260` | Gray dot |

### 4.5 Forbidden on this screen

- Violet/purple fills on rail, list selection, badges, footer chips  
- Rainbow provider icons (keep monochrome; differentiate via glyph + optional 1-letter monogram)  
- Green-as-brand competing with green-as-ready (accent mint vs status ok should be **close but ordered**: accent slightly cooler/brighter for selection; status ok slightly more saturated for readiness)

**Accent vs status.ok distinction rule:**  
- Selection surfaces → `accent.primary`  
- “Ready/configured” → `status.ok`  
Never use purple to mean either.

---

## 5. Layout & dimension spec

### 5.1 Window / shell

| Region | Width | Height / padding |
|--------|------:|------------------|
| Rail expanded | **200** (was ~220) | full height |
| Rail collapsed | **56** | full height |
| Rail item height | **32** | h-pad 10, icon 16, gap 10 |
| Page header block | full content width | top 20, bottom 12 |
| Page title | — | 20–22pt semibold |
| Page subtitle | — | 12pt regular, `ink.tertiary` |
| Content horizontal pad | **24** | from rail edge / window edge |
| Content top pad under header | **8** | |
| Status bar | full width | **36** height |
| Max content column (optional clamp) | **1080** total master+detail | avoid ultra-wide stretch |

### 5.2 Providers page — master / detail

| Region | Spec |
|--------|------|
| Layout | `HStack(alignment: .top)` with resizable divider (optional v2) |
| Master column | **240** fixed (range 220–280 if resizable) |
| Detail column | `maxWidth: .infinity`, min **420** |
| Column gap | **20** (no heavy vertical rule required; prefer 1px `border.subtle` full height) |
| Master vertical | list fills height; sticky footer under list |
| Detail vertical | single `ScrollView`; sticky playground dock optional |

### 5.3 Master: provider list

**Component:** `HudProviderList` → built on refined `HudListRow` / new `HudSelectableRow`

| Element | Dimension |
|---------|-----------|
| Section label | **omit** (page title already says Providers) *or* micro label `5 PROVIDERS` at 10pt, tracking +0.6, `ink.quaternary` |
| Row height | **52** regular / **44** compact density |
| Row corner radius | **10** |
| Row gap | **6** |
| Row h-pad | **10** |
| Icon well | **28 × 28**, radius 8, fill `surface.inset`, stroke `border.subtle` |
| Icon glyph | 14pt, `ink.secondary` default; `accent.primary` when selected |
| Title | 13pt semibold selected / medium unselected |
| Subtitle | 11pt, 1–2 lines max, `ink.tertiary`, line limit 2 |
| Trailing cluster | right-aligned, gap 6 |
| Selected row | fill `surface.selected`, stroke `accent.primary` @ 28%, **1.0** pt |
| Hover row | fill `surface.cardHover` |
| Status | 7pt dot + optional 10pt label only in accessibility large content size |

**Trailing badge order (LTR):**  
`[DEFAULT]` (if default) → `[READY|SETUP]` (text badge, not only dot) → chevron none

| Badge | Fill | Text |
|-------|------|------|
| DEFAULT | `accent.soft` | `accent.primary`, 9pt bold caps |
| READY | `status.ok` @ 12% | `status.ok` |
| SETUP | transparent + `border.subtle` | `ink.tertiary` |

### 5.4 Detail: vertical stack

Recommended structure (replaces equal triple cards):

```
┌ Detail ──────────────────────────────────────────────┐
│ A. Provider identity strip (non-card, 40–44h)        │
│    Name · one-line summary · Set as default button   │
│ B. Credential strip (compact card, ~72–88h)          │
│ C. Primary workspace card: Voices / Model            │
│ D. Optional advanced: Instructions / model params    │
│ E. Playground dock (sticky bottom of detail)         │
└──────────────────────────────────────────────────────┘
```

#### A. Identity strip

| Item | Spec |
|------|------|
| Height | 40–44 |
| Title | 15pt semibold |
| Meta | 11pt tertiary |
| Primary text action | “Set as default” / “Default provider” (mint text button, not purple badge only) |

#### B. Credential strip — `HudCredentialBar` (new primitive)

| Item | Spec |
|------|------|
| Padding | 12–14 all sides |
| Radius | 12 |
| Layout | leading icon (muted, **not** accent) · title+caption · spacer · status badge · secret field full width row 2 · helper + link row 3 |
| Secret field height | **32** |
| Status badge | READY / NOT CONFIGURED (semantic colors only) |
| Link “Get API Key” | `status.info` or `ink.secondary` underline on hover — not accent-critical |

#### C. Voice selection — `HudChoiceList` / `HudVoiceRow`

| Item | Spec |
|------|------|
| Card pad | 12 outer; list inset 0 |
| Section header | 10pt caps, `ink.quaternary`, bottom 8 |
| Row height | **40** (single primary line) or **48** if keeping caption |
| Caption | optional 11pt; prefer caption only on hover/selected to reduce density |
| Radio | 16pt SF Symbol or custom 14pt circle |
| Selected fill | full-row `surface.selected`, left 2pt accent bar **or** radio fill accent |
| Preview button | 28×28 circular, icon `play.fill` 10pt; idle `ink.secondary`; hover `accent.primary` |
| Divider | none between rows; use 4pt gaps + hover fill |
| Disabled (no key) | opacity 0.45, preview disabled, tooltip “Add API key to preview” |

**Density default for OpenAI (6 voices):** **compact rows (40h) + caption always visible** is acceptable if card pad tightens to 12 and playground undocks.

#### D. Advanced

Collapse “Voice Instructions” behind `HudDisclosure` (“Advanced”) so first fold stays credential + voices.

#### E. Playground dock — `HudPlaygroundDock`

| Item | Spec |
|------|------|
| Placement | sticky bottom of detail column **or** bottom of scroll with min visible height 120 |
| Height collapsed | 48 (single line + Play) |
| Height expanded | 120–140 |
| Text field | single-line `HudField` default; expand to 2–3 lines on focus |
| Play CTA | solid `accent.primary`, height 32, radius 8, label `ink.onAccent` |
| Meta | current voice name, 11pt tertiary |

This fixes the screenshot problem: Playground no longer competes mid-stack and gets clipped.

---

## 6. HudsonKit primitive proposals

These should be **product-agnostic** in HudsonUI; SpeakEasy supplies tint via `HudAppManifest` / environment.

### 6.1 Tokens (HudsonUI)

```
HudPalette / HudTheme
  surfaces: bg, chrome, panel, card, cardHover, inset, selected
  ink: primary, secondary, tertiary, quaternary, onAccent
  accent: primary, soft, muted, strong   // from manifest tint
  status: ok, warn, error, info, idle
  border: subtle, strong, focus

HudSpacing (freeze numeric scale if not already public):
  xxs 2 · xs 4 · sm 6 · md 8 · lg 12 · xl 16 · xxl 20 · xxxl 24 · huge 32

HudRadius:
  tight 6 · control 8 · row 10 · card 12 · panel 14

HudRowMetrics:
  compact 40 · regular 48 · comfortable 56
```

### 6.2 Components to promote / refine

| Primitive | Purpose | Key API sketch |
|-----------|---------|----------------|
| `HudSelectableRow` | Master lists (providers, devices, accounts) | title, subtitle, icon, selected, trailing `View` |
| `HudStatusBadge` | READY / SETUP / DEFAULT / ERROR | `kind: StatusKind`, size `.sm/.md` |
| `HudCredentialBar` | API key / token patterns | title, helper, binding secret, status, action link |
| `HudChoiceList` | Radio lists (voices, models) | selection binding, rows, density |
| `HudChoiceRow` | Single choice + optional trailing action | title, subtitle?, isSelected, trailing |
| `HudPlaygroundDock` | Test input + primary play | text, isPlaying, onPlay, accessory |
| `HudSectionHeader` | Caps label with optional trailing control | title, trailing |
| `HudMasterDetail` | Two-column settings layout | master width, divider, master, detail |
| `HudIconWell` | Neutral icon container | systemName, size, emphasized: Bool |

### 6.3 What not to bake into primitives

- Hardcoded `HudTint.violet` as default selected chrome  
- Provider-specific marketing subtitles  
- SpeakEasy-only “Playground” copy (use generic “Test” / slot label)

### 6.4 SpeakEasy-specific composition (app layer)

```
ProviderSettingsView
  HudMasterDetail(masterWidth: 240) {
    ForEach providers → HudSelectableRow + HudStatusBadge
  } detail: {
    ProviderIdentityStrip
    HudCredentialBar
    HudChoiceList(voices)
    HudDisclosure("Advanced") { instructions / model }
    HudPlaygroundDock
  }
```

---

## 7. Visual hierarchy target (after)

**Scan path (F-pattern, first 2 seconds):**

1. Rail: Providers selected (mint ghost, not purple slab)  
2. Master: which provider row is selected + READY/SETUP  
3. Detail: credential READY badge  
4. Voice list: selected voice with mint radio + preview  
5. Dock: Play test

**Type scale on this screen**

| Role | Size / weight |
|------|----------------|
| Page title | 20 / semibold |
| Page subtitle | 12 / regular |
| Provider row title | 13 / medium–semibold |
| Provider row subtitle | 11 / regular |
| Card/section label | 10 / semibold, +0.6 tracking, uppercase |
| Voice title | 13 / medium |
| Voice caption | 11 / regular |
| Badge | 9 / bold, uppercase |
| Helper / link | 11 / medium |
| Status bar | 11 / regular |

---

## 8. Density modes

Ship **one default** (Regular). Allow compact later via environment.

| Mode | Provider row | Voice row | Card pad | Use |
|------|-------------:|----------:|---------:|-----|
| Compact | 44 | 36–40 | 10 | Power users, short windows |
| Regular (default) | 52 | 44–48 | 12 | Current capture target |
| Comfortable | 56 | 52 | 16 | Accessibility / large text |

At **1597×772**, Regular should show without clipping: identity + credential + all 6 OpenAI voices + playground dock collapsed. Expanded playground may scroll.

---

## 9. Interaction notes (layout-adjacent)

- **Single click** selects provider (already).  
- **Double-click** optional: set default.  
- **Keyboard:** ↑↓ in master; ←/→ or Tab into detail; Space preview focused voice.  
- **Empty key state:** voice list visible but previews disabled; credential strip uses `status.warn` / SETUP, not a dead empty purple icon.  
- **Default provider:** show only one DEFAULT badge; move “default” from decorative pill to explicit control in identity strip.

---

## 10. Priority fix list (implementation order when unblocked)

1. **Retint SpeakEasy manifest** from `.violet` → mint/teal; purge hardcoded violet in provider rows, API key icon, DEFAULT badge, footer chip.  
2. **Introduce master–detail metrics** (240 / 20 gap / drop redundant `PROVIDERS` label).  
3. **Compact credential strip** + semantic READY badge.  
4. **Unify selection language** (mint ghost + border) for rail, provider row, voice row.  
5. **Voice row density + accent preview control.**  
6. **Playground dock** so test action is always reachable.  
7. **Promote primitives** into HudsonKit once SpeakEasy path is stable.

---

## 11. Acceptance criteria (design QA)

- [ ] No purple/violet on Providers screen chrome, selection, or badges  
- [ ] Accent matches player mint family  
- [ ] Configured state readable at arm’s length (badge, not only 7px dot)  
- [ ] At 1440×900 and 1600×800: OpenAI detail shows key + all voices without horizontal scroll; playground dock visible  
- [ ] Selected provider, selected voice, and primary Play share one accent system  
- [ ] Empty left-column void reduced (list feels anchored; optional master footer present)  
- [ ] Page does not repeat the word “Providers” more than twice (rail + H1)

---

## 12. Out of scope (this pass)

- Functional API/key validation UX copy  
- ElevenLabs multi-section voice browser IA deep dive  
- Light theme full palette  
- Code implementation  
- Menu-bar player redesign (reference only for accent)

---

## Appendix A — Current code smell (for implementers)

| Location | Issue |
|----------|--------|
| `ShellRootView` `HudAppManifest(tint: .violet)` | Product accent = purple |
| `ProviderSettingsView` `iconTint: .violet`, DEFAULT `HudTint.violet` | List branded purple |
| `ProviderAPIKeySection` key icon violet | Credential icon should be neutral/muted |
| `OpenAIPlaygroundView` equal `GlassSection` stack + 60pt editors | Density / clipping |
| `VoiceRow` selection = checkmark only | Weak selected surface |
| `PlayerPopoverView` mint accent | Correct product accent; settings should match |

## Appendix B — Palette quick reference (copy block)

```
// SpeakEasy dark — Providers
bg            #0B0C0E
chrome        #101214
card          #15181C
cardHover     #1A1E24
inset         #0A0C0F
ink           #F2F4F7
inkSecondary  #B8C0CC
inkTertiary   #7A8494
inkMuted      #525A66
border        #FFFFFF0F
accent        #4FDEB0
accentSoft    #4FDEB024
statusOk      #3DDC97
statusWarn    #E0A84A
statusError   #F07178
statusInfo    #6EB6FF
statusIdle    #4A5260
onAccent      #04120E
```
