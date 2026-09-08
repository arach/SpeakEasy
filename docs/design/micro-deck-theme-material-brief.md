# Micro Deck — theme material studies (Opus + Kimi)

**Ship a studio page. Diff, not a proposal.** Each agent owns a *separate* page so we can compare takes side by side.

Studio runs at `http://localhost:5193` (`design/studio`, `pnpm dev` / already on port 5193).

---

## Two independent pages

| Agent | New page file | Registry href | Label |
|-------|---------------|---------------|--------|
| **Opus** | `design/studio/src/studio/MicroThemesOpusStudy.tsx` | `/studio/studies/micro-themes-opus` | `SE-STU · Micro themes · Opus` |
| **Kimi** | `design/studio/src/studio/MicroThemesKimiStudy.tsx` | `/studio/studies/micro-themes-kimi` | `SE-STU · Micro themes · Kimi` |

**Do not edit the other agent’s page.** Wire only *your* page into:

- `design/studio/src/studio/studioRegistry.ts` (add one entry under studies)
- `design/studio/src/studio/StudioPages.tsx` (import + route)

Keep `LaneConsoleStudy.tsx` as the geometry reference; copy the layout into your study (do not break the shared study).

---

## Geometry you must match (exact)

### Full Micro Deck (required playground)

Not just the console strip. The live playground must be the **full Micro surface**:

1. **Chrome** — host link + MICRO DECK label  
2. **Hand column** — lane picker (01–05, ACTIVE/ARMED) + key pad + Hold to Speak  
3. **Eye column** — ledger console (identity + turns + player foot)

Shared shell helper: `design/studio/src/studio/MicroDeckFullMock.tsx`  
Pass the lane console as `children`. Theme tokens drive pad/lanes/hold as well as the console.

### Eye column (ledger + fused player)

Source of truth:

- Screenshot: `docs/design/lane-panel-shots/player-m5-ledger.png`
- Swift: `deck/ipad/Sources/NativeDeckView.swift` (`ActiveLaneInstrument` ledger)
- Swift: `deck/ipad/Sources/DeckPlayerConsole.swift` (embedded player foot)
- Studio reference layout: `design/studio/src/studio/LaneConsoleStudy.tsx`

### Column structure

```
┌─ ONE outer surface (rounded ~10, 1px hard edge) ─────────────┐
│  IDENTITY                                                     │
│   [50pt gutter: 01]  [project · phase]                        │
│                      [branch · session chips]                 │
│  ── hairline ──                                               │
│  LEDGER (same panel fill as identity — not a recessed card)   │
│   [YOU  / AGENT in gutter]  [body on text rail]               │
│  ── hairline ──                                               │
│  PLAYER FOOT (different plate texture)                        │
│   head: TURN · status + caption (indented to text rail)       │
│   band: ring in gutter + figure bay (same height)             │
│   tape clock under bay only: 0:00 · current · total           │
│   chips on floor: speed · vol · autoplay                      │
└───────────────────────────────────────────────────────────────┘
```

### Shared rail (must line up)

| Token | Value |
|-------|--------|
| edge pad | 14 |
| gutter | 50 |
| column gap | 12 |
| text rail origin | 14 + 50 + 12 = 76 |

- Numeral, YOU/AGENT, play ring → **gutter**
- Project name, turn body, TURN title/caption → **text rail**
- No second scrub rail under the wave (figure is scrub)
- No duration under the ring
- Fixed player height ~2U (e.g. 156pt if U=78)
- Hard 1px edges; no soft glow as structure

---

## Five themes to redesign

Current iPad palettes: `deck/ipad/Sources/DeckTheme.swift`

| ID | Current vibe | Scheme |
|----|--------------|--------|
| **flight** | Void graphite, mint signal | dark |
| **obsidian** | Technical black, cool blue | dark |
| **ceramic** | Warm daylight console | light |
| **porcelain** | Quiet white, tailored graphite | light |
| **amber** | Low-light studio deck | dark |

### Your job

Make **each** theme more beautiful in this *exact* Micro layout by redesigning:

1. **Color** — full token set (page, panel, panelHead, cell, trace, line, lineSoft, ink ladder, accent family, amber, plate*, pad*, empty, mic*)
2. **Material / texture** — not just hex swaps. Think industrial design:
   - retro-future console
   - brutalist instrument plate
   - brushed metal / anodized aluminum
   - liquid glass / refractive light surfaces
   - ceramic glaze / porcelain skin
   - warm vacuum-tube amber
   - etc.
3. **Lighting** — top-lit plate, recessed wells, live signal only where live
4. **Spacing & type** — grouping, rhythm, mono vs sans for caption; keep the ledger rail
5. **Chrome language** — chips, ring, waveform bay, hairlines — per material

Each theme should feel like a **different material object**, not a hue-shifted copy of Flight.

### Hard constraints

- Layout geometry stays (rail, bands, 2U player, no second scrub rail)
- Live signal (mic / speaking) may use accent; do not neon-wash the chassis
- Ceramic + Porcelain must work as *light* themes (no dark-on-dark hacks)
- Prefer CSS that can later map back to `DeckThemePalette` hex tokens
- No new product surface; this is a **studio study** only

---

## Knobs & tools (required)

The page is not a static gallery. After your first beautiful defaults, the operator must be able to **tweak everything**:

### Must-have controls

1. **Theme picker** — all five themes, one-click switch  
2. **Lifecycle mode** — ready / listening / speaking / paused (at least) so light and figures animate  
3. **Per-theme token editor** — every palette key as color input (or grouped: chassis / ink / signal / plate / pad)  
4. **Material preset per theme** — at least 2–3 named material directions per theme (e.g. Flight: “void graphite” / “liquid glass mint” / “brutal plate”) that re-seed tokens  
5. **Global tweak knobs** (shared, live):
   - corner radius (outer surface + figure bay + chips)
   - border strength / line opacity
   - plate gradient strength
   - hairline weight
   - type scale (identity / ledger / player)
   - gutter width (default 50, range ±)
   - player height (2U lock toggle + override)
   - spacing scale (identity padding, ledger row gap, player internal)
   - live accent intensity / glow amount (0 = crisp only)
6. **Export** — button to copy current theme as JSON matching `DeckThemePalette` field names (or Swift-ready hex literals)  
7. **Reset** — restore your designed defaults for the active theme  

### Nice-to-have

- Side-by-side compare: two themes at once  
- A/B material snapshot save in `localStorage`  
- Scrub position / volume / speed interactive on the player mock  
- “Crisp only” toggle that kills all soft light  

---

## Page content shape

1. Short thesis (what material language you chose per theme)  
2. Live Micro column playground with all knobs  
3. Five theme cards or a strip showing the same mock in each theme at your defaults  
4. Export panel  

Use `PageHeader` from `@/studio/PageHeader` like other studies.

---

## Done criteria

- [ ] Your page loads at your registry href on `localhost:5193`  
- [ ] Micro mock matches ledger geometry  
- [ ] All five themes present with distinct material identity  
- [ ] Knobs actually change the live mock  
- [ ] Export produces usable token JSON  
- [ ] No edits to the other agent’s files  

Report: files changed, URLs, material thesis per theme (1 line each), and how to export tokens.
