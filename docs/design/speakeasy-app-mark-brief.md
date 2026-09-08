# SpeakEasy app mark — open brief

This is a blank canvas. There is no house style to honour, no prior concept to
extend, and no palette you are obliged to keep. Design the mark you think is
right and argue for it.

## What the thing actually is

SpeakEasy is two products sharing a name.

1. **A TTS library and CLI** — unified text-to-speech across macOS `say`,
   OpenAI, ElevenLabs, Gemini, with a queue, caching, and a native macOS
   menu-bar player. This is the older half.
2. **The Deck** — the half that now defines the product. A flight-deck control
   surface for driving Codex agents by voice. Nine lanes, each bound to a Codex
   thread. You hold a button, speak, and the utterance is transcribed *on the
   device* by an embedded Parakeet model and dispatched to a lane. The agent's
   reply is spoken back. The iPad app is a hardware-feeling instrument panel:
   monospace, keypad, level meters, no chrome.

The name is a double meaning that has never been used: *speak easy* (talking to
machines without friction) and *speakeasy* (the prohibition bar you get into by
speaking at a door). Use either, both, or neither.

## Where the mark ships

- iOS/iPadOS app icon — `deck/ipad/Assets.xcassets/AppIcon.appiconset` (15 PNGs)
- macOS app icon — `AppIcon.icns`, regenerated on every bundle build
- Web favicon — `landing/app/icon.png` (512)

## Hard constraints — these are real, everything else is yours

1. **It must read at 40 px.** That is the size a home screen renders. This is
   the single constraint that kills most ideas; test it before falling in love.
2. **iOS/web render full-bleed.** The system applies its own mask; pre-rounding
   leaves a dark halo. **macOS masks nothing** and must carry Apple's icon grid
   itself (824/1024 content box, 185.4/1024 corner radius) on transparency.
3. **It must be code-rendered.** No design tools are available in this
   environment. The current pipeline is a single Swift/CoreGraphics generator,
   `design/icon/speakeasy-icon.swift`, with four targets (`ipad`, `macos`,
   `landing`, `master`). You may rewrite its drawing entirely, restructure it,
   or replace the approach — keep the four target contracts so
   `app/tools/release/common.sh` keeps working, or update that call too.
4. **Original work only.** No third-party logos, no traced marks.

## Explicitly NOT constraints

- The Flight palette (`#74F2CE` mint on `#05090B`) is what the app's UI uses.
  You are not required to use it. If a good app icon needs a different colour
  strategy than the UI it opens, make that case.
- Dark is not mandatory. Neither is a glow, a plate, a waveform, or a mic.
- Skeuomorphic, flat, typographic, illustrative, abstract — all open.
- You do not have to match the existing macOS or iPad icons. Both are being
  replaced.

## Prior art, offered only so you can avoid repeating it

`design/icon/` currently holds an attempt: a "speakeasy door plate with a lit
slot and a voice coming through it," mint on near-black. The owner's verdict was
"not really that good." Treat it as a **rejected baseline**, not a starting
point. You are explicitly not being asked to refine it. If your best judgment
lands somewhere near it, say why it survives the same criticism.

## What to deliver

1. **Several genuinely distinct directions** — different concepts, not
   variations on one. Render each at 1024.
2. **A legibility sheet** for every direction at 152 / 120 / 80 / 58 / 40 px,
   squircle-masked, on a neutral field. This is the honest test and it should
   inform which direction you recommend, not just document it.
3. **A recommendation with reasoning** — what it means, why it survives 40 px,
   why it beats the others, and what it gives up.
4. **The winner wired through the generator** so all three platforms render from
   one source.

Do not commit. Leave everything in the working tree and report what changed.

Spend the effort. Exploring ten ideas and discarding nine is the expected shape
of this task, not waste.
