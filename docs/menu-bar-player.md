# Permanent menu-bar player

> **Canonical user doc:** [menu-bar-player.mdx](./menu-bar-player.mdx) (published
> via the docs site navigation). This file remains as an in-repo copy of the
> original product note; prefer the `.mdx` page for updates.

SpeakEasy uses one resident macOS application for playback, HUD presentation,
settings, and history. The TypeScript package remains responsible for speech
synthesis and caching. It hands generated audio files to the app instead of
owning `afplay` as its primary playback path.

## Product surface

- The menu-bar popover is the primary surface: current item, play/pause, stop,
  skip, scrubber, volume, playback speed, and queue.
- Settings and history open as secondary windows in the same application.
- The HUD remains an optional ambient surface driven by real player metering.
- Narration text follows playback progress in the HUD, and a validated
  `sourceThreadId` can provide a **Back to Codex** task link.
- The app has no Dock icon during normal operation (`LSUIElement`).
- If the app or IPC endpoint is unavailable, the CLI may use its existing
  direct-playback path as a compatibility fallback.

## Ownership boundaries

| Component | Owns | Does not own |
| --- | --- | --- |
| TypeScript core | Providers, synthesis rate/WPM, cache, history metadata | Playback state or a cross-process queue |
| CLI and skills | Generate audio, enqueue commands, display actionable errors | Long-lived playback processes |
| SpeakEasy.app | Autoplay, transport controls, queue, volume, playback speed, metering, HUD | Provider credentials or network synthesis |

Synthesis rate and playback speed are deliberately separate. `synthesisRateWPM`
is part of generation and cache identity. `playbackRate` is an immediate player
setting in the range `0.5...2.0`.

## IPC contract

The app listens on `/tmp/speakeasy-player.sock`. Each connection sends one
newline-delimited JSON request and receives one newline-delimited JSON response.
The initial protocol version is `1`.

```json
{
  "protocolVersion": 1,
  "requestId": "UUID",
  "command": "enqueue",
  "arguments": {
    "item": {
      "id": "UUID",
      "audioPath": "/absolute/path/to/audio.mp3",
      "title": "Build summary",
      "text": "Optional full spoken text",
      "provider": "elevenlabs",
      "createdAt": "2026-07-24T18:00:00Z",
      "synthesisRateWPM": 160,
      "sourceThreadId": "019f9573-3e55-7701-8968-09c12d4fafe5"
    },
    "priority": "normal",
    "interrupt": false,
    "autoplay": true
  }
}
```

Commands are `enqueue`, `pause`, `resume`, `togglePlayback`, `stop`, `skip`,
`seek`, `setVolume`, `setPlaybackRate`, `removeQueueItem`, `clearQueue`, and
`status`. Commands with scalar values use `positionSeconds`, `volume`, or
`playbackRate` in `arguments`. Queue removal uses `itemId`.

The enqueue-level `autoplay` flag applies only to that item. It does not change
the player's persistent autoplay preference. `resume` starts the next queued
item when the player is idle.

`sourceThreadId` is optional and must contain only letters, numbers, hyphens,
or underscores before the app creates a `codex://threads/<id>` link.

Every response echoes `requestId`, reports `ok`, and includes the latest player
snapshot. Errors are stable machine-readable strings where practical.

```json
{
  "protocolVersion": 1,
  "requestId": "UUID",
  "ok": true,
  "snapshot": {
    "state": "playing",
    "currentItem": {},
    "queue": [],
    "currentTime": 4.2,
    "duration": 12.8,
    "volume": 0.8,
    "playbackRate": 1.0,
    "autoplayEnabled": true,
    "audioLevel": 0.34
  }
}
```

## Compatibility sequence

1. Ship the menu-bar shell without changing CLI playback.
2. Add the playback engine and socket endpoint.
3. Route generated audio through the app when the version handshake succeeds.
4. Keep the HUD FIFO and direct playback for one compatibility release.
5. Remove simulated levels and broad process killing after adoption is proven.
