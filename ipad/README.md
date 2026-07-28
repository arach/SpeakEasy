# SpeakEasy Pad for iPad

This is the first native shell around the proven Mac-hosted Pad.

## What works in this shell

- scans the existing one-day QR with the iPad camera;
- remembers the unexpired pairing link in the device Keychain;
- runs the same `pad.speakeasy.local:8255` control surface in a persistent `WKWebView`;
- preserves the existing Mac-authoritative commands, acknowledgements, revisions, and revoke controls;
- adds native success/error/selection haptics through a deliberately tiny JavaScript bridge;
- exposes rescan, reload, and forget controls without adding a second settings system.

The web Pad remains the zero-install path. This shell is an additive convenience layer, not a fork of the product UI.

## Build

```bash
cd ipad
xcodegen generate
xcodebuild -project SpeakEasyPad.xcodeproj -scheme SpeakEasyPad \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

## iPad audio follow-on

Do not silently swap microphones. Add an explicit **Input: Mac / iPad** mode and a separately negotiated `audio.capture.v1` capability.

The native path should:

1. request microphone permission only after the user selects iPad input;
2. use `AVAudioSession` + `AVAudioEngine` to capture a mono stream;
3. carry bounded audio frames on a separate binary channel, not in command JSON;
4. let the Mac feed those frames into the existing transcription/task submission pipeline;
5. stop or duck iPad playback while capturing, handle interruptions, and surface route changes;
6. leave the Mac as the authority for task locks, submission, and command acknowledgement.

Once HudsonBridge’s native companion client is published, replace the local `WKWebView` transport with Bonjour discovery, Keychain identity, and the shared typed protocol. The SwiftUI shell and its camera/haptic/audio integrations can stay.
