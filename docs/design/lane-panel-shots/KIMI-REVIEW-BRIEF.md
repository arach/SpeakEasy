# Micro Deck — lane + player surface review

Please review this screen as a product/design critic. Be specific and opinionated. Prefer concrete layout calls over general praise.

## Screenshot (primary)

`/Users/arach/dev/SpeakEasy/docs/design/lane-panel-shots/player-m5-for-kimi.png`

iPad Pro 11" M5 simulator · SpeakEasy Deck · Micro surface · Flight theme · connected to live Deck.

Also useful (same layout family):
- `player-m5-tape-clock.png` — after tape clock + type tweaks
- `player-m5-sim.png` — earlier mid-session

## What this surface is

Right column of Micro Deck: **one fused panel**

1. **Identity** — lane numeral (`01`) + project name + phase lamp + branch/session
2. **Exchange** — recessed YOU/AGENT transcript well (scrollable)
3. **Player foot** — plate texture, same outer border as identity/exchange  
   - TURN · status + caption  
   - transport ring + waveform bay (same height, one horizontal band)  
   - tape clock under the bay only: `0:00` · current · total  
   - chips on the floor: speed · vol · autoplay  

Constraints the team is holding:
- Tokens only (`DeckPalette` / Flight + Ceramic)
- Hard 1px edges, no soft glow as structure
- Player fixed 2U height (pad grid)
- No second scrub rail under the wave (figure is the scrub surface)
- Ring is transport, not a second clock
- Crisp instrument, not chat UI chrome

## Implementation (if you want source)

- `deck/ipad/Sources/DeckPlayerConsole.swift` — player face
- `deck/ipad/Sources/NativeDeckView.swift` — `ActiveLaneInstrument` identity + Micro stack
- Studio target geometry: `design/studio/src/studio/LaneConsoleStudy.tsx`

## Recent changes (context, not a changelog to rubber-stamp)

- Fused player into lane surface (no separate card/gap)
- Bigger play ring; figure height = ring height
- Chips pinned to bottom of player
- Removed duration under the ring; tape clock under waveform
- Nudged TURN head lower; tightened identity typography (project name vs numeral)

## What we want from you

1. **Overall read** — does the column feel like one instrument or three boxes?
2. **Identity** — numeral vs project name balance; phase/branch noise
3. **Exchange well** — density, role labels, empty space
4. **Player foot** — ring vs bay alignment; tape clock; chips; caption hierarchy
5. **Top 3 concrete fixes** (priority order) — spacing, type, hierarchy, or structure
6. **One thing to protect** — what already works and must not be undone

Keep the review under ~400 words. Bullet the fixes. No rewrite of the whole product.
