# Split the Codex pack out of the public build

Status: decided, not started. Companion to `tiers.md`, which holds the
reasoning.

## What we're doing

Charge for the Codex integration and the Pad while keeping the TTS core open
and free — and the Mac app, Deck included, free. The bar is **two steps of
friction**, not protection: the paid material does not sit inside something
people download for another reason, and getting it is a deliberate act.
Nothing further — no obfuscation, no runtime license checks, no private main
repo.

## Non-goals

- Preventing a determined person from reading the code. Impossible and not
  worth spending on.
- Retroactively protecting anything. Every published npm version stays
  downloadable; `0.2.19` already contains all of this.
- Making the main repo private. Public source keeps the privacy claims
  verifiable, and what we sell is a working install, not secrecy.
- Runtime entitlement enforcement. A key exchanged for a download URL is the
  whole mechanism.

## Where we are (verified, 2026-08-09)

The `files` allowlist in `package.json` publishes the paid material explicitly:

```json
["dist", "!dist/test.*", "deck/index.html", "deck/themes.json",
 "deck/variants", "app/Sources/SpeakEasy/Resources/codex-desktop-bridge.cjs"]
```

`npm pack --dry-run` → 15 files, 525 KB, including `codex-desktop-bridge.cjs`
(the `state_5.sqlite` path, the `ATTACH` of `codex-dev.db`, the
`PRAGMA query_only` WAL technique) and the whole deck surface.

`dist/bin/speakeasy-cli.js` is a single unminified bundle containing
`DeckRuntime`, `assignLane`, `thread-catalog`, and `codex-desktop-submit`.

**The seam is clean.** The only entry into the deck subtree is the dynamic
`await import('../cli/deck')` at `speakeasy-cli.ts:76`; nothing in core
(`src/index.ts`, doctor, ui, app-manager) imports deck code, and the deck
files' own imports all flow inward. The split is a build change, not a
refactor. `--doctor` has no deck-dependent paths.

`app/tools/release/common.sh` bundles the core into the Mac app twice over:
line 170 runs `bun build --compile` on `src/bin/speakeasy-cli.ts` (the dynamic
import compiles through, so the deck code is inside the embedded
`speakeasy-runtime` binary), and lines 404–406 copy `deck/index.html`,
`deck/themes.json`, and `deck/variants/` into `Contents/Resources/Deck/`.

`deck/ipad/project.yml` references nothing outside its own directory. Already
a clean cut.

The shipping Codex page is `landing/app/codex/page.tsx`, with "Download DMG"
buttons. The App Store treatment lives in
`docs/design/the-pad-landing-mock.html`, an unshipped design mock.

## The change

### 1 · Stop publishing the paid material

Reduce `files` to `["dist", "!dist/test.*"]`. The bridge is only ever read by
the Mac app, which takes it from the repo at build time; the deck assets are
bundled into the app the same way. Neither has a reason to be in an npm
tarball.

### 2 · Split the CLI build

The dynamic import at `speakeasy-cli.ts:76` is the seam, and it is clean
(verified above). Make the deck subtree a separate artifact that the public
npm bundle does not include.

In the free CLI, `speakeasy deck` says plainly "the Codex pack isn't
installed", with the URL — not a module-not-found.

The Mac app is unaffected: its runtime keeps the deck code because the app
keeps the Deck. The split changes what npm publishes, not what the app
bundles.

Artifact shape — esbuild external, a second tsup entry, or relocating
`src/cli/deck*.ts` and `src/cli/codex-*.ts` into `packs/codex/` — is an
implementation choice; the subtree is the clearest boundary.

### 3 · Packs ride the plugin mechanism

`runPlugin()` in `src/cli/plugin.ts` already does the whole job: resolve a
release tag, download a tarball, validate its paths against traversal, install
into a per-host directory, back up what was there, run a health check, roll
back on failure, prune old backups. A paid pack is that flow with a gated
source and a pack destination.

`speakeasy plugin` is the inventory — hosts today, packs alongside them. One
inventory, one noun. Packs extend the mechanism we already ship; we are not
building a second delivery system.

### 4 · The Mac app keeps the Deck

Decided. The Deck stays in the free app as a working feature — it is the
funnel for the Pad — and `common.sh` keeps compiling the full runtime and
copying the deck surface. Two constraints from the audit still stand:

- `common.sh:170` bun-compiles the whole CLI into `speakeasy-runtime`, dynamic
  import included. The deck code inside the app binary is intended, not a
  leak — but it means the npm split cannot be verified by inspecting the app,
  only by inspecting the tarball.
- A pack must never install into `Contents/Resources`: writing into a signed
  bundle breaks its signature. Packs land in Application Support and the app
  loads them from there.

### 5 · The Pad

Distribution is the product. Most people will not install a developer build on
the iPad they actually use; a purchase buys a signed, installable Pad on that
device. TestFlight/App Store work starts now — it has the longest external
latency, and the paid product depends on it. `docs/release/gtm.md:157` records
no TestFlight or App Store artifact yet, and line 270 put public distribution
post-launch; that gap is now the critical path.

Open: whether `deck/ipad` moves to a private repo. It is self-contained either
way, and since the sale is install friction removed rather than code hidden,
nothing forces the move.

## The Codex dependency

Real but bounded. The bridge reads Codex Desktop's internals, and those move.
If they move away from us, there are other ways to interact with Codex — this
one happens to work beautifully today. Treat it as a dependency to track, not
an existential threat. It does argue against a subscription: we should not
sell continuity on someone else's internals.

## Open questions

- Price.
- Merchant of record and key issuance.
- Support and refund burden once money changes hands — "the bridge broke"
  becomes a refund request, not a GitHub issue.
- Whether `deck/ipad` moves to a private repo.
- The TestFlight/App Store gap (`docs/release/gtm.md:157`, `:270`).

## Risks

- **Two delivery paths to maintain** — public npm and a gated pack endpoint —
  where there is one today.
- **Nothing already published gets protected.** `0.2.19` stays downloadable
  forever. Accepted; it is a non-goal.

## Sequencing

Decided: `0.2.19` ships free first. The `files` trim is a one-line diff and
rides along with it. The CLI split and the gated pack endpoint follow the
launch. TestFlight/App Store starts immediately, in parallel — longest lead
time, and everything paid waits on it.
