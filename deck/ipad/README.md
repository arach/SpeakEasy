# SpeakEasy Deck — iPad app

A native shell for the deck: a full-screen `HudWebView` (HudsonKit) that finds
`speakeasy deck` on the local network and loads it. No QR, no URL, no pin.

## How it works

- `DeckDiscovery` browses `_http._tcp` for the `SpeakEasy Deck (<mac>)` service
  that `speakeasy deck` advertises over Bonjour, then loads
  `http://<mac-host>:<port>` in the web view.
- The deck page itself owns the WebSocket to the Mac runtime (same-origin,
  through Caddy's proxy) — the app is a pure shell, so every deck feature
  (lanes, hold-to-speak, playback, themes) works as in the browser.
- Hold to Speak needs mic permission (`NSMicrophoneUsageDescription`).

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
| `project.yml` | xcodegen spec — HudsonKit via `../../../hudson`, team `2U83JFPW66` |
| `Sources/SpeakEasyDeckApp.swift` | `@main` entry point |
| `Sources/DeckRootView.swift` | discovery-driven `HudWebView` shell |
| `Sources/DeckDiscovery.swift` | Bonjour discovery of the deck service |
| `Sources/Info.plist` | Bonjour, local-network, mic permissions |
