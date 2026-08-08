# SpeakEasy app mark

The shipped mark is **Mouth Keyhole**: a speaking aperture inside a prohibition-
era keyhole. It finally uses both readings of the name — *speak easy* and
*speakeasy* — without drawing a literal door, microphone, or waveform.

The idea emerged from a broad image-generated exploration, then was rebuilt
independently as deterministic CoreGraphics geometry. No generated pixels ship.
The keyhole is one continuous Bézier path with a heavy brass outline; the mouth
is a lip path around one almond aperture. That construction stays crisp from 20
through 1024 px.

`speakeasy-icon.swift` is the only source used to render shipped icons:

```sh
swift design/icon/speakeasy-icon.swift ipad    deck/ipad/Assets.xcassets/AppIcon.appiconset
swift design/icon/speakeasy-icon.swift macos   <dir>          # writes AppIcon.icns
swift design/icon/speakeasy-icon.swift landing landing/app/icon.png
swift design/icon/speakeasy-icon.swift master  design/icon    # 1024 reference
```

The macOS bundle regenerates its icon on every bundle build through
`app/tools/release/common.sh`. The iPad set and site favicon are committed
artifacts, so rerun those targets after changing the drawing.

## Review artifacts

Six deterministic directions and their actual-pixel legibility sheets are
generated from the same script:

```sh
swift design/icon/speakeasy-icon.swift studies design/icon/studies
```

Each sheet tests 152 / 120 / 80 / 58 / 40 px under a superellipse mask on a
neutral field. The image-generated exploration boards and their contact sheet
are under [`studies/generated/`](studies/generated/). See
[`app-mark-review.md`](app-mark-review.md) for the comparative reasoning.

## Production decisions

- **Full bleed on iOS and web.** The system supplies the icon mask; the source
  PNGs have colour in every corner and therefore cannot develop a dark halo.
- **Apple's icon grid on macOS.** The macOS target puts an 824/1024 content box
  with a 185.4/1024 corner radius on transparency because macOS applies no mask.
- **Actual small-size rendering.** Geometry is re-rendered at each requested
  size, not drawn once and blindly downsampled. The 40 px test retains the
  keyhole outline, coral lip, and open dark aperture.
- **A compact signal palette.** Oxblood `#2B0E1C`, ink `#160912`, brass
  `#F8D58A`, and coral `#FF624B` evoke a private night-time entrance without
  turning the icon into a period illustration.
