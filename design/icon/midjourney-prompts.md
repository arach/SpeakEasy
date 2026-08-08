# SpeakEasy app mark — Midjourney exploration prompts

## The thesis changed

Rounds 1–2 explored the *name*: prohibition, brass, keyholes, Deco doors. That
was etymology, not product. Nothing in the shipped app is Deco, and its privacy
claim is on-device Parakeet — a technical boundary, not a nightclub door.

The product is a **control surface**. `deck/ipad/README.md` calls the iPhone
app "intentionally a keypad-first instrument." There are six real lane
arrangements (Console, Cluster, Flight Deck, Checklist, Glass PFD, Micro Deck),
five themes, faders, detents, and mixer strips. Round 2 rejected the Deck Matrix
direction for being "too close to a keypad" — that rejection was backwards.

**The mark is a keypad of lanes with one pad live.** Not the grid alone (that is
a calculator, a dialer, an app launcher). The grid *plus one active pad* — lanes
at rest, one selected, metering to a voice. That is what `NativeDeckView`
actually looks like, it is ownable, and it is legible at 40 px because it is
large rectangles plus one accent.

Midjourney output is **reference only**. The winner gets rebuilt as
deterministic CoreGraphics geometry in `speakeasy-icon.swift`.

## Constraints every prompt inherits

- Single object, centered, full bleed to the corners (the OS supplies the mask).
- Must survive 40 px: nothing thinner than ~1/20 of the canvas. At that size a
  3×3 grid gives ~11 px pads — the practical floor. Do not go finer.
- Flat vector. No bevels, glass, 3D, drop shadows, or perspective rake.
- Exactly one accent color. The live pad is the only saturated thing present.
- No faces, no letters, no numbers.

## Palette — Flight (`DeckTheme.swift`)

Unlike round 2, the icon should now agree with the instrument.

```
page #05090B · pad #142328 · line #1F333A · mint #74F2CE · amber #E0A83F
```

---

## A — Live pad

The core idea, stated plainly. Nine pads, one lit.

```
flat vector app icon, three by three grid of dark rounded-square pads on a near
black panel, one single pad glowing bright mint green, generous even gutters
between pads, audio instrument control surface, bold simple geometry, centered,
full bleed, flat design, two color plus one accent, iOS app icon, no text
--ar 1:1 --v 7 --style raw --s 50 --no calculator, phone dialer, keyboard, app
launcher, numbers, letters, text, watermark, 3d render, bevel, glossy,
perspective, thin lines
```

## B — Live pad with level

Same, but the live pad carries a level meter — the voice is visible.

```
flat vector app icon, three by three grid of dark rounded-square pads, one pad
lit mint green containing three short horizontal audio level bars, remaining
pads flat and unlit, near black panel, mixing console pad bank, extremely bold
geometry, centered, full bleed, flat design, one accent color, iOS app icon,
no text --ar 1:1 --v 7 --style raw --s 50 --no calculator, dialer, keyboard,
equalizer graph, numbers, letters, text, watermark, 3d, bevel, gloss,
perspective
```

## C — Mixer strips

The Flight Deck surface: wide vertical channel strips, one active with its
fader raised.

```
flat vector app icon, four wide vertical mixer channel strips on a near black
panel, each with a small fader cap, one strip lit mint green with its fader
raised high, the others dim and low, audio mixing console reduced to flat
geometry, very bold thick shapes, centered, full bleed, flat design, one accent
color, iOS app icon, no text --ar 1:1 --v 7 --style raw --s 50 --no equalizer,
bar chart, graph, numbers, letters, text, watermark, 3d render, gloss, knobs,
thin lines
```

## D — One pad, macro

Maximum reduction: a single pad, cropped close, with a voice level across it.
The safest possible 40 px behavior — worth testing as the floor case.

```
flat vector app icon, one large dark rounded-square instrument pad filling most
of the frame on a near black field, a single bold mint green waveform level bar
across its center, thick rounded border, no other detail, extremely minimal,
centered, full bleed, flat design, one accent color, iOS app icon, no text
--ar 1:1 --v 7 --style raw --s 50 --no numbers, letters, text, watermark, 3d,
bevel, gloss, button, play icon, thin lines
```

## E — Lane column, one speaking

Lanes as stacked rows, one emitting. Keeps the routing story without round 2's
nine-endpoint fan that collapsed at small size.

```
flat vector app icon, four stacked horizontal rounded bars of differing lengths
on a near black panel, the second bar lit mint green and extending further than
the others, remaining bars dim, task lanes on a control surface, bold thick
geometry, generous spacing, centered, full bleed, flat design, one accent color,
iOS app icon, no text --ar 1:1 --v 7 --style raw --s 50 --no bar chart, graph,
menu icon, hamburger, list, numbers, letters, text, watermark, 3d, gloss
```

---

## How to run it

1. Fire all five, `--r 4` for a wider spread per direction.
2. A is the thesis; B is A with the voice made visible. If B holds at 40 px it
   is the stronger mark. D is the fallback if nine pads prove too fine.
3. Reject anything that reads as a calculator or dialer — that means the pads
   are uniform and the accent is not carrying enough weight.
4. Screenshot survivors at 40 px before judging the 1024.
5. Winner comes back here as geometry, not pixels.

Swap `--v 7` if you are on a newer Midjourney release, and drop `--style raw`
if that release removed it.

## Superseded

`app-mark-review.md` recommends Mouth Keyhole and is retained as the record of
rounds 1–2. Its recommendation is dead; its 40 px legibility method is still
the right test.
