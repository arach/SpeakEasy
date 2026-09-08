# Deck

Deck is OpenScout's responsive, installable local control surface. It keeps the Mac authoritative: Deck selects a lane and requests semantic listening/playback actions, while the Mac owns task locks, microphone capture, Codex submission, narration, and state revisions.

## Run it

```sh
cd pad
bun run dev
```

Open `http://localhost:43210`. The root route is an interactive local demonstration so the full control surface can be evaluated independently of the Mac transport.

```sh
bun run check
```

The production bundle is written to `pad/dist/`.

## Deck themes

The finish picker (topbar → layout button) includes built-in themes and any custom deck themes created on the device. A custom theme is a Chrome-extension-style manifest — metadata, design-token `colors`, custom `css`, and optional `html` chrome — created or imported in the appearance sheet. Theme HTML mounts app regions through slots and interaction attributes defined by **Deck Theme Contract v1** in `docs/theme-contract.md`.

## Live transport seam

`src/transport.ts` defines the only UI transport dependency. The local pilot opens `/pad` on the exact host and port that served the page, presents the reusable day-pass fragment, stores a revocable reconnect secret for that browser, and sends the exact versioned command envelope shared with Swift. This naturally resolves to `ws://pad.speakeasy.local:8255/pad` on the canonical route and continues to work when the Mac advertises an IP or fallback port. The connection surface labels this honestly as `Trusted-LAN pilot`; HTTP `.local` is not a WebCrypto secure context.

Unexpected disconnects with a valid lease use one bounded exponential-backoff loop. Returning the Pad to the foreground starts a fresh bounded attempt window. Revocation, authentication failure, lease expiry, and manual disconnect stop reconnection immediately; controls remain disabled until `session.accepted` supplies a complete replacement snapshot.

The hosted successor may register `window.SPEAKEASY_PAD_SECURE_TRANSPORT` before `app.js` runs to provide an E2EE `PadTransport` without changing UI code.

QR links use the versioned fragment shape from `docs/design/speakeasy-pad-turnkey-mvp.md`:
```text
http://pad.speakeasy.local:8255/connect#v=1&room=…&tid=…&iat=…&exp=…&ct=…&k=…
```

The app parses the day-pass fragment, rejects expired/overlong/weak payloads, and keeps the exact URL intact so Code Scanner can hand it to Safari. The Mac may authorize several browser sessions from the same pass and revoke them individually. On a secure hosted origin, an installed E2EE transport factory takes precedence.

The `.local` hostname is product identity and LAN routing. Real deployment beyond a trusted LAN still needs a trusted HTTPS origin for WebCrypto and service workers. `localhost` is used only for development.
