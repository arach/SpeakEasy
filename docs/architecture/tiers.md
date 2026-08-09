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

The corollary: the moat is not secrecy, it is maintenance. Codex Desktop's
internals move. The integration keeps working because we keep tracking them.
Whoever copies today's bridge owns today's bridge.

## The tiers

### 1 · Core — npm, open, free

`@arach/speakeasy` on npm. The TypeScript library and the `speakeasy` CLI:
providers, voices, fallback, cache, config, `--doctor`.

Open source, MIT, no key required, works standalone. This tier is a
distribution channel, not a product to defend — every reason to make it as
frictionless as possible.

### 2 · App — signed download, free

The macOS app: settings, voice configuration, the menu-bar player, permissions,
the update path. Helper and surface for tier 1, and nothing more.

Free and signed. Its job is to make tier 1 pleasant for people who do not live
in a terminal, and to be the thing tier 3 plugs into.

### 3 · Plugins — paid, delivered on request

Additional functionality that is not part of the core product. Today that is
one pack: **the Codex integration and the Pad** — the Codex Desktop bridge,
the deck runtime, the lane binding, and the iPad app.

Delivered the way tier 1 already delivers skills: a tarball of files placed in
the right location, installed by the user's agent rather than by hand. The
mechanism exists — `speakeasy plugin <host>` already downloads a release
tarball, validates its paths, installs it, health-checks it, and rolls back on
failure. A paid pack is the same flow pointed at a gated source.

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

Everything above ships publicly today. The `files` allowlist in `package.json`
names the bridge and the deck assets explicitly.

## What "two steps" actually means here

1. **Not in anything published for another reason.** Drop the bridge and the
   `deck/` assets from the npm `files` allowlist; split the CLI build so the
   deck runtime is not inside the public bundle. After this, `npm pack` yields
   the TTS product and nothing else.
2. **Fetched deliberately.** The pack comes from a gated URL rather than a
   public release asset. A key exchanged for a download link is enough; it does
   not need to be enforced at runtime.

That is the entire scheme. No third step.

## Consequences worth accepting

- **The free Mac app loses the Deck.** `app/tools/release/common.sh` currently
  copies the deck surface into the bundle. Under this split it stops, and
  Settings → Deck becomes an affordance to install the Codex pack.
- **Already-published versions stay published.** Every tarball on npm is
  downloadable forever. This protects what we build from here.
- **The public repo can stay public.** Once the tier-3 material is not
  published, source visibility costs little — and it keeps the privacy claims
  ("your Mac does the transcribing") verifiable, which is worth more than the
  clone it prevents.
