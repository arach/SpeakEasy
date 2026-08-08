# SpeakEasy app mark review

## Recommendation: Mouth Keyhole

Ship **06 — Mouth Keyhole**.

The second exploration round changed the recommendation. Nine Dial remains a
good small icon, but the generated boards exposed a stronger brand idea: the
only opening in a prohibition-era keyhole is a mouth. That collapses *speak
easy* and *speakeasy* into one compact silhouette. It belongs to the name in a
way a rotary control, patch bay, waveform, or microphone cannot.

The raster concept was not traced or embedded. The production version is rebuilt
from one continuous CoreGraphics keyhole path plus a lip path and one almond
aperture. A heavy brass outline prevents the form becoming a person
or generic location pin. The dark interior reads as a private aperture; the
coral lip is the live voice action.

At 40 px the keyhole remains about 20 px wide, the brass outline remains roughly
2 px, and the lip is approximately 11 × 5 px. The inner slit stays open. The
mark therefore loses polish but not meaning at the limiting size.

## What the generated work changed

Four built-in image-generation passes explored 24 sketches across:

1. voice-to-many routing, switchboards, plugs, and patch bays;
2. Deco doors, sliding apertures, keyholes, gramophone horns, and coded knocks;
3. breath, lips, hush, opposing apertures, and speaking irises;
4. rotary controls, phone dials, safe dials, and wildcard hybrids.

The contact sheet is `studies/generated/contact-sheet.png`; source boards and
the prompt set are preserved beside it.

The routing boards confirmed that one-to-many is the right product story but a
poor 40 px glyph: nine endpoints force lines below two pixels, while reducing
the count turns it into a generic share/network icon. Rotary exploration found
some memorable silhouettes, but the indexed rings still belonged to hardware
in general. Breath and opposing-aperture marks were calm and legible but too
category-wide. The Mouth Keyhole sketch was the only route that was both
small-size viable and inseparable from the SpeakEasy name.

## Deterministic directions

| Direction | Idea | 40 px result | Decision |
|---|---|---|---|
| **01 — Nine Dial** | Nine lane detents around one talk control | All detents and the active lane remain distinct | Strong product metaphor, but it can still read as a generic instrument dial |
| **02 — Duplex S** | Two speech paths interlock as utterance and reply | The two-colour path and endpoints survive | Can read as a question mark or abstract link |
| **03 — Voice Key** | A listening aperture becomes an access key | Exceptionally clear key silhouette | Over-promises security and says little about the name's speaking-door pun |
| **04 — Deck Matrix** | Nine tactile lane keys with the centre held | The grid remains immaculate | Too close to a keypad, calendar, or app launcher |
| **05 — Prompt Mouth** | A spoken wedge becomes a terminal prompt | Strongest pure small-size glyph | Could brand any terminal tool; loses privacy and human exchange |
| **06 — Mouth Keyhole** | A mouth is the only opening in a brass keyhole | Outline, lip, and aperture all remain distinct | **Recommended.** Most ownable idea and the clearest expression of the name |

## Why it beats Nine Dial

Nine Dial communicates the current product architecture more literally. Mouth
Keyhole communicates the enduring brand more specifically. The Deck may grow
beyond nine lanes; the name will still mean frictionless speech through a
private entrance. It also avoids Nine Dial's residual sun/gear/control-knob
readings while using fewer visual parts.

What Mouth Keyhole gives up is immediate technical explanation. A new viewer
will not infer queueing, routing, or agent lanes from the icon. That is an
acceptable job for product copy and onboarding. The app mark's job is to be
recognized, remembered, and tied to the name.

## Palette

- **Oxblood — `#2B0E1C`:** private, nocturnal, and warmer than the rejected
  near-black Flight plate.
- **Ink — `#160912`:** separates the aperture from the background without using
  a material effect or drop shadow.
- **Brass — `#F8D58A`:** supplies the Deco-era cue and the high-contrast keyhole
  boundary.
- **Coral — `#FF624B`:** keeps the mouth unmistakably live and contemporary.

This palette intentionally differs from the Deck UI. The icon is a launcher
signal, not a screenshot of the instrument panel.

## Output contract

All production assets come from `design/icon/speakeasy-icon.swift`:

- `ipad`: 15 full-bleed PNGs using the asset-catalog filenames
- `macos`: `AppIcon.icns`, with Apple's content box and transparent exterior
- `landing`: one 512 px full-bleed PNG
- `master`: the 1024 px recommended reference
- `studies`: six 1024 directions, six legibility sheets, and a contact sheet

Changing the single `winner` constant switches every production target without
duplicating drawing code. The generated raster boards remain review evidence
only and are never read by a shipping target.
