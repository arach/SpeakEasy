# SpeakEasy Deck — iOS app

A hybrid iPad and iPhone control surface for `speakeasy deck`. It finds every
Mac on the local network and remembers the selected one. The latency-sensitive
controls are native SwiftUI; the presentation-heavy lane viewer remains a
WebKit surface. iPad presents the two as a split. iPhone is intentionally a
keypad-first instrument and opens the lane viewer only when you tap Activity.
No QR, URL entry, or pin.

## How it works

- `DeckDiscovery` browses `_http._tcp` for every `SpeakEasy Deck (<mac>)`
  service advertised over Bonjour. With multiple Macs, a native machine menu
  switches between them and remembers the last selection.
- `DeckConnection` owns a native `URLSessionWebSocketTask`. The Mac runtime is
  still authoritative: it publishes `snapshot` messages and receives the same
  schema-validated intents used by the browser deck.
- `NativeDeckView` renders the established Flight keypad, hold-to-speak,
  transport, volume, and searchable lane-assignment sheet as native SwiftUI.
  These tactile controls send intents directly over the native socket.
- The native Appearance sheet offers Flight, Obsidian, Ceramic, Porcelain, and
  Amber as miniature renders of the complete hybrid surface. Its pinned action
  bar keeps Apply Changes reachable at every scroll position. Applying a theme
  updates both SwiftUI and the WebKit lane viewer, and persists the choice.
- Control surface is independent from theme. Console, Cluster, Flight Deck,
  Checklist, Glass PFD, and Micro Deck are six real SwiftUI lane arrangements;
  every variant keeps lane selection, metering, and Hold to Speak native.
  Flight Deck uses six wide mixer strips with an effort-level fader and a
  three-detent model indicator: Terra left, Luna center, and Sol right.
- Compact width is composed independently: the top controls become two rows,
  transport controls become a 3×2 bank, Hold to Speak keeps a full single-line
  label, and Flight Deck channels retain fixed widths in a horizontal scroller.
- Companion Link is also native: it reports the actual paired route, can force
  a reconnect or restart Mac discovery, and copies a safe diagnostic summary.
- `DeckLaneWebView` loads the existing web lane console in presentation-only
  mode. It shows conversation history, playback state, and traces without its
  top bar or duplicate keypad. It follows native selections through the Mac's
  authoritative snapshots, so there is no private JavaScript state bridge.
- Narration downloads through the paired URL session and plays with
  `AVAudioPlayer`. The iPad reports its real progress to the runtime, so pause,
  speed, volume, replay, stop, and completion keep the existing semantics.
- **Hold to Speak is Parakeet-first.** `SpeechCapture` records one private PCM
  WAV with `AVAudioEngine`; release uploads it to `/api/transcribe`, where the
  Mac app's embedded Parakeet model produces the only transcript. The iPad no
  longer requests Speech Recognition permission or runs `SFSpeechRecognizer`.
- While recording, the same native audio tap publishes a perceptual RMS level
  at 30 Hz. SwiftUI uses it to animate the selected pad's sparkline in direct
  response to the speaker's voice; no WebKit bridge participates.

The browser deck remains available from `speakeasy deck`; its full layout is
unchanged unless `surface=console` is explicitly requested by the iPad shell.

## Build

```sh
xcodegen generate --spec project.yml
# simulator:
xcodebuild -project SpeakEasyDeck.xcodeproj -scheme SpeakEasyDeck \
  -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)' build
# compact simulator:
xcodebuild -project SpeakEasyDeck.xcodeproj -scheme SpeakEasyDeck \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
# a real iPad (uses the Lattices team profile):
./build-device.sh
```

`build-device.sh` prefers a device whose name contains "iPad"; pin one with
`SPEAKEASY_DEVICE_ID` (cached in `.device-id.local`). When a paired HTTPS Deck
is already running, the script also provisions that exact connection into the
iPad app: the paired URL and this Mac's public Caddy trust anchor travel over
the Xcode device channel, then move into this-device-only Keychain storage.
The app validates only that paired host, so the direct developer install needs
no certificate profile and remains connected when it is opened normally later.

## Layout

| File | Role |
| --- | --- |
| `project.yml` | xcodegen spec — team `2U83JFPW66`, Bonjour/network/mic permissions |
| `Sources/SpeakEasyDeckApp.swift` | `@main` entry point |
| `Sources/DeckRootView.swift` | discovery-driven full-screen surface |
| `Sources/DeckDiscovery.swift` | Bonjour discovery of the deck service |
| `Sources/DeckModels.swift` | Codable snapshot, lane, message, catalog, trace, and URL contract |
| `Sources/DeckConnection.swift` | WebSocket intents/snapshots, Parakeet upload, and native audio playback |
| `Sources/NativeDeckView.swift` | native keypad, hold-to-speak, transport, and lane setup |
| `Sources/DeckSettingsView.swift` | sticky Appearance picker and companion diagnostics |
| `Sources/DeckSurface.swift` | persistent native control-surface selection |
| `Sources/DeckTheme.swift` | persistent native/WebKit theme palettes |
| `Sources/DeckWebView.swift` | presentation-only WebKit lane viewer and paired-host trust |
| `Sources/SpeechCapture.swift` | private PCM WAV capture for the Mac's Parakeet engine |
| `Sources/Info.plist` | Bonjour, local-network, and microphone permissions |
