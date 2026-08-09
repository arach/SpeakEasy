# Three tiers, two steps of friction

How we decide what is open, what is free, and what is paid — and how the paid
part is delivered.

## The principle

Everything is readable by a determined person. Bundles are unminified, tarballs
are text, and anyone can `npm pack` a published version. We are not trying to
stop that, and we should not spend effort pretending otherwise. Obfuscation,
license checks compiled into binaries, and anti-tamper work all cost real time
and buy approximately nothing.

What we want is **two steps of friction**: the paid pieces are not sitting in a
tarball someone downloads for another reason. Getting them should require
deliberately going and getting them. That is the whole bar.

And secrecy is not what we sell anyway. Most people will not install a
developer build on the iPad they actually use. The product is the removal of
that friction: a signed, installable Pad on the device you own. That is why
public source and a paid build are not in tension — readable code does not put
a working install on your iPad.

The corollary: the moat is maintenance and distribution, not secrecy. Codex
Desktop's internals move; the integration keeps working because we keep
tracking them. Whoever copies today's bridge owns today's bridge.

## The tiers

### 1 · Core — npm, open, free

`@arach/speakeasy` on npm. The TypeScript library and the `speakeasy` CLI:
providers, voices, fallback, cache, config, `--doctor`.

Open source, MIT, no key required, works standalone. This tier is a
distribution channel, not a product to defend — every reason to make it as
frictionless as possible.

### 2 · App — signed download, free

The macOS app: settings, voice configuration, the menu-bar player, permissions,
the update path — and the Deck. The Deck stays in the free app. It is the demo
and the funnel for tier 3, and it is worth more there than behind a gate.

### 3 · Plugins — paid, delivered on request

Additional functionality that is not part of the core product. Today that is
one pack: **the Codex integration and the Pad** — the Codex Desktop bridge,
the deck runtime, the lane binding, and the iPad app.

Delivered through the mechanism tier 1 already has. `speakeasy plugin <host>`
downloads a release tarball, validates its paths, installs it, health-checks
it, and rolls back on failure — and its listing is the inventory of what is
installed. Packs join that inventory: the same flow pointed at a gated source.
One inventory, not two nouns. This is the architecture.

## Where the line falls

A file belongs to tier 3 if it encodes how we talk to something we do not own,
or if it only exists to serve the Pad.

| Tier 3 today | Currently lives in |
| --- | --- |
| `app/Sources/SpeakEasy/Resources/codex-desktop-bridge.cjs` | npm tarball + Mac app |
| `src/cli/deck-runtime.ts` | npm CLI bundle |
| `src/cli/codex-desktop-submit.ts`, `codex-thread-catalog.ts` | npm CLI bundle |
| `deck/index.html`, `deck/themes.json`, `deck/variants/` | npm tarball + Mac app |
| `app/Sources/SpeakEasy/CodexThreadRouter.swift` | Mac app |
| `deck/ipad/**` | public repo |

The tier-3 files that serve the Mac app's Deck keep shipping inside the app —
deliberately, because the app is the funnel. The two-step bar applies to npm
and to the pack channel.

## What "two steps" actually means here

1. **Not in anything published for another reason.** Drop the bridge and the
   `deck/` assets from the npm `files` allowlist; split the CLI build so the
   deck runtime is not inside the public bundle. After this, `npm pack` yields
   the TTS product and nothing else. The Mac app is a deliberate exception,
   not a leak.
2. **Fetched deliberately.** The pack comes from a gated URL rather than a
   public release asset; the Pad comes from the store. A key exchanged for a
   download link is enough; nothing is enforced at runtime.

That is the entire scheme. No third step.

## Consequences worth accepting

- **Tier-3 code ships inside the free Mac app.** On purpose: the Deck is the
  screenshot, the demo, and the funnel for the Pad.
- **Already-published versions stay published.** Every tarball on npm is
  downloadable forever. This protects what we build from here.
- **The public repo stays public.** It keeps the privacy claims ("your Mac
  does the transcribing") verifiable, and since what we sell is a working
  install rather than the code, visibility costs nothing.
