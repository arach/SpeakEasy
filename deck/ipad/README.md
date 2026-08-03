# SpeakEasy Deck — iPad app

A native shell for the deck: a full-screen web surface that finds every
`speakeasy deck` on the local network, remembers the selected Mac, and loads
it — plus a native hold-to-speak engine. No QR, URL entry, or pin.

## How it works

- `DeckDiscovery` browses `_http._tcp` for every `SpeakEasy Deck (<mac>)`
  service advertised over Bonjour. With multiple Macs, a native machine menu
  switches between them and remembers the last selection.
- The deck page itself owns the WebSocket to the Mac runtime (same-origin,
  through either the bundled server or Caddy proxy) — the app is a pure shell
  for lanes, playback, themes, and the trace rail.
- **Set lanes is shared with the website.** It shows all nine pads alongside
  the Mac's Codex projects and exact user-facing task titles, so lane bindings
  can be searched, moved, or reset to a fresh task without leaving the iPad.
- **Hold to Speak is native.** The page posts capture phases to the
  `speakeasyDeck` message handler; `SpeechCapture` runs `SFSpeechRecognizer`
  with `AVAudioEngine` and streams partial and final transcripts back through
  `window.speakeasyDeck.nativeTranscript`. The page marks the native path via
  an injected `window.speakeasyNativeTranscription` user script, so the web
  SpeechRecognition fallback stays for browsers.

## HudsonKit note

The first version of this app used HudsonKit's `HudWebView`. The speech
bridge needs a script message handler, which `HudWebView` doesn't expose
yet, so the surface is a thin `UIViewRepresentable` following the
`HudCanvasSurface` handler convention instead. The clean upstream fix is
message-handler support in `HudWebViewConfiguration`; when that lands, this
app can go back to the stock component.

## Build

```sh
xcodegen generate --spec project.yml
# simulator:
xcodebuild -project SpeakEasyDeck.xcodeproj -scheme SpeakEasyDeck \
  -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)' build
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
| `project.yml` | xcodegen spec — team `2U83JFPW66`, Bonjour/network/mic/speech permissions |
| `Sources/SpeakEasyDeckApp.swift` | `@main` entry point |
| `Sources/DeckRootView.swift` | discovery-driven full-screen surface |
| `Sources/DeckDiscovery.swift` | Bonjour discovery of the deck service |
| `Sources/DeckWebView.swift` | WKWebView + `speakeasyDeck` message handler bridge |
| `Sources/SpeechCapture.swift` | `SFSpeechRecognizer` + `AVAudioEngine` capture engine |
| `Sources/Info.plist` | Bonjour, local-network, mic, speech permissions |
