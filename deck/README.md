# Speakeasy Deck — embeddable control surface

A single self-contained control surface: a 9-pad hardware plate on the left, a lane console
with conversation, audio scrubbing and a trace rail on the right. One HTML file, vanilla JS —
no framework, no build step, no CDN.

Open `index.html` in a browser, run `bun run serve.ts` here for http://localhost:43211, or
bundle the file into a native app.

## Ship it to an iPad

The deck ships inside the SpeakEasy CLI package. On the Mac:

```sh
npx @arach/speakeasy deck
```

That serves the live deck on the local network (via Caddy when installed, the fully live built-in server otherwise),
advertises **speak.\<your-mac\>.local** over Bonjour, and prints a QR code. It uses 43211 for a
normal user install (or port 80 only when the process is permitted to bind it). On the iPad (same Wi-Fi):

1. Scan the code or open the printed URL (e.g. `http://speak.air.local`) in Safari.
2. Share → **Add to Home Screen** for the full-screen deck.
3. Pick a look: `?theme=paper|ember|flight`, or a variant like `?variant=oxide`.

Options: `--port <n>`, `--host <name>` (default `speak.<device>.local`), `--no-qr`, `--no-caddy`,
`--no-mdns`. The public server proxies the loopback runtime under same-origin `/ws`, `/api`, and
`/audio` routes: hold-to-speak runs the real phase machine with real synthesis on the Mac, and
`speakeasy "text"` from any shell mirrors into the open deck. Caddy is only the optional local-HTTPS
upgrade; it is not required for live lanes. Without the runtime the page falls back to demo state. Is it running?
`curl http://localhost:<port>/healthz` on the printed port. Prefer your own server?
`caddy run` in this directory uses the shipped `Caddyfile`.

Run SpeakEasy on more Macs to add machines. Each advertises its own `SpeakEasy Deck (<host>)`
Bonjour service; the native iPad shell lists them in a machine menu and remembers the last choice.

## Set lanes from the deck

Choose **Set lanes** from the deck header on the website or in the iPad app. The shared setup
workspace keeps all nine pads visible and groups recent tasks under the same project labels and
user-facing titles shown by the Codex app. Search matches task titles, projects, previews, paths,
and full thread IDs; for example, a renamed Codex task such as `spk-web` appears as `spk-web`, not
as the rollout prompt that originally created it. Choosing a task moves its binding to that pad
without deleting or modifying the Codex task. **Fresh session** clears the pad so its next spoken
request starts a new Codex task.

## Boot options

Read from the query string (never `localStorage` — see below).

| Param | Default | Effect |
|---|---|---|
| `theme` | `paper` | Seed theme: `paper`, `ember`, or `flight` |
| `se-<token>` | — | Override any token, e.g. `&se-accent=%23ff5c47` |
| `trace` | `1` | `0` hides the trace rail |
| `snippets` | `1` | `0` hides the last-reply snippet on each pad |

## Adding your own design

Two tiers, deliberately simple:

**Variant — a file-based layer over a base.** A folder in `variants/<name>/` with any of:

```txt
variants/oxide/
  variant.json   { "id", "title", "base": "flight", "overrides": { …tokens } }
  style.css      arbitrary CSS layered over the base (optional)
  chrome.html    HTML fragment mounted at #se-chrome   (optional)
```

Boot it with `?variant=oxide`; `?se-*` params still stack on top. Variants are registered in
`themes.json` alongside the templates and ship as device-owner content — they are loaded
same-origin and are not sanitized.

**Template — a design as an app.** A bigger design is its own self-contained HTML file in this
directory, playing by the same contract: the `:root` token names, `data-hudson-template` /
`data-hudson-theme`, and the host bridge. Register it in `themes.json` next to
`speakeasy-deck` and it becomes selectable like an app. The existing deck is simply the first
template in the catalog; its three seeds are variants of it.

**One-off override — just a URL.** Any `--se-*` token straight from the query string or the
host bridge, no files at all:

```text
deck/?theme=flight&se-accent=%23ff5c47&se-page-bg=%2302080a
```

```js
speakeasyDeck.setTheme('ember', { accent: '#ff5c47', 'page-bg': '#02080a' });
```

## Themes

The deck ships three seed themes, all driven by the same token set:

- **paper** — warm field-notes light, the default
- **ember** — dark warm console; the pad plate stays paper (the pad surface is always paper, whatever the console does)
- **flight** — full dark with the SpeakEasy signal teal, plate included

Switch with `?theme=ember` at boot, or `speakeasyDeck.setTheme('flight')` from a native host at
runtime. `state()` reports the active theme.

The whole look lives in the `:root` token block at the top of the file plus the `SEEDS`
overrides in the script. Nothing elsewhere hardcodes a color, so a new seed is just a token
map — no markup or JS changes. The root element carries `data-hudson-template` /
`data-hudson-theme`, and each seed declares its `light`/`dark` scheme.

When the Hudson theme format is final, the token block becomes a
`[data-hudson-template="speakeasy-deck"]` scope and the tokens alias across to the semantic
surface (`--se-panel: var(--card)`, `--se-ink: var(--foreground)`, `--se-line: var(--border)`,
`--se-accent: var(--accent)`, …) — at which point the deck is a drop-in for any template.

Type is two families, both with local fallbacks: Spectral for the display line, JetBrains Mono
for everything else. The Google Fonts `<link>` is the file's only external request — delete
that one line for a hermetic bundle and the fallbacks take over.

## Built for HudsonKit's web surface

Written against the contract in `HudsonKit/Sources/HudsonUIWeb` (`HudWebView.swift`,
`HudWebSurface.swift`). Each item below is a concrete accommodation, not a general best practice.

**Loads from the bundle.** `HudWebSurfaceLocation.bundled(directory:indexFile:)` resolves through
`Bundle.url(forResource:subdirectory:)` and loads a **file URL**, so relative paths resolve.

```swift
HudWebSurface(
    HudWebSurfaceDescriptor(
        id: "speakeasy.deck",
        title: "Micro Deck",
        location: .bundled(directory: "deck", indexFile: "index.html"),
        lifecycle: .keepWarm
    ),
    configuration: HudWebViewConfiguration(
        allowsBackForwardNavigationGestures: false,
        isInspectable: true
    )
)
```

**The host paints the background.** `HudWebViewPlatform.apply` sets `isOpaque = false` /
`drawsBackground = false`, so `html` and `body` stay transparent and the deck shell paints its
own page background. Native material shows through anywhere the shell does not cover.

**Nothing runs while nothing moves.** Under `lifecycle: .keepWarm` the surface is held alive
off-screen. The 120 ms transport interval is created only while a clip is playing or the mic is
held, and is torn down on `visibilitychange` — an idle or hidden deck schedules no timers.

**Repaints patch, they don't replace.** An `innerHTML` swap at playback tempo would reset scroll
offsets and restart every CSS animation eight times a second. Renders diff against the live tree
and touch only what differs, so DOM nodes — and therefore scroll position and running
animations — survive. Verified: the same pad node is reused across playback ticks.

**No persistent storage.** `usesNonPersistentDataStore` may be on, so no state is read from or
written to `localStorage`; configuration comes in through the query string.

**Nothing navigates.** `allowsBackForwardNavigationGestures` defaults to `true`, so the page
contains no anchors, and drag-start is suppressed. Set it `false` on the host as well.

**Pointer capture for hold-to-speak.** Repainting on press re-runs hit-testing, and the browser
emits `pointerout`/`pointerleave` on the pad — which cancels the hold on the frame it began.
The pad takes an explicit `setPointerCapture`, so the same code path drives mouse, trackpad and
touch, and the matching `pointerup` always lands even if the finger drifts off.

**Touch hygiene.** Callout, tap highlight and overscroll chaining are all off; transcript copy
stays selectable, chrome does not.

## Talking to the host

Both directions are optional and no-op in a plain browser.

**Deck → native, without a bridge.** `HudWebViewCoordinator` KVO-observes `title` into
`HudWebViewState.title`, so the deck keeps the document title current
(`Speakeasy · 02 Hudson · READY · LANE 02`). Native chrome can render live deck state with no
script message handler configured at all.

**Deck → native, with a bridge.** If the host installs a `speakeasyDeck` script message handler,
the deck posts `ready`, `lane`, `playback`, `capture`, `trace` and `visibility` messages to it.

**Native → deck.** `window.speakeasyDeck` exposes `selectLane`, `stop`, `setTheme` and `state` for
`evaluateJavaScript`.

## Layout

Authored at desk width. At 1000 px and below the two plates stack, the surface switches from
viewport-clamped to naturally tall, and scrolling moves to the page — so a panel-width web view
gets the full nine pads instead of a squeezed grid and a horizontal scrollbar.
