# SpeakEasy Deck — iPad app

A native shell for the deck: a full-screen web surface that finds
`speakeasy deck` on the local network and loads it — plus a native
hold-to-speak engine. No QR, no URL, no pin.

## How it works

- `DeckDiscovery` browses `_http._tcp` for the `SpeakEasy Deck (<mac>)` service
  that `speakeasy deck` advertises over Bonjour, then loads
  `http://<mac-host>:<port>` in the web view.
- The deck page itself owns the WebSocket to the Mac runtime (same-origin,
  through Caddy's proxy) — the app is a pure shell for lanes, playback,
  themes, and the trace rail.
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
`SPEAKEASY_DEVICE_ID` (cached in `.device-id.local`).

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
