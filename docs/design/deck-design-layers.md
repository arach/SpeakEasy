# Deck design layers — the extensibility map

How a design gets onto the SpeakEasy deck, from cheapest to most committed. The rule that
shaped this: **no new formats unless the layer above genuinely runs out of room.** Every layer
is just token values, CSS, or HTML — the deck owns structure, designs own paint and frame.

## The three layers

| Layer | Lives in | What it can change | Ships as |
| --- | --- | --- | --- |
| **URL overrides** | the link itself | any `--se-*` token, one-off | a shareable URL |
| **Variant** | `deck/variants/<name>/` | base seed + token overrides + arbitrary CSS + HTML chrome | a folder, registered in `themes.json` |
| **Template** | `deck/<name>.html` | everything — a full app honoring the contract | a file, registered in `themes.json` |

### 1. URL overrides — "overwrite anything"

Any `--se-*` token from the query string (`?theme=flight&se-accent=%23ff5c47`) or
`speakeasyDeck.setTheme(name, overrides)`. Overrides are per-token, exactly as named — the
accent *family* (`accent`, `pad-accent`, `mic-a`, `wave-on`, …) must be named explicitly.
Nothing is stored; the design is the link.

### 2. Variant — a file-based layer over a base

```txt
deck/variants/<name>/
  variant.json   { id, title, base, overrides }   required
  style.css      arbitrary CSS over the base       optional
  chrome.html    HTML fragment at #se-chrome       optional
```

Boot with `?variant=<name>`. Precedence: seed → variant overrides → query params; first paint
waits on the variant so the base never flashes. Variant CSS/chrome persist across runtime
`setTheme()` — the variant is the frame, the seed is the paint. Loaded same-origin as
device-owner content; deliberately **not** sanitized. Example shipped: `variants/oxide`.

### 3. Template — a design as an app

A standalone HTML file in `deck/` honoring the same contract (`:root` token names,
`data-hudson-template` / `data-hudson-theme`, the host bridge). Registered in
`themes.json` next to `speakeasy-deck`, selectable like an app. The current deck is template
#1; its three seeds (paper / ember / flight) are variants of it in the loose sense.

## The catalog

`deck/themes.json` is the single registry: `templates[]` and `variants[]`, each with `id`,
`title`, `path`, `description`. Anything presenting designs (the studio, a native host) reads
the catalog rather than scanning the filesystem.

## Relationship to the Pad theme system

The Pad (worktree branch `codex/pad-micro-activity-polish`) has its own, richer system:
Chrome-extension-style manifests (`manifest_version` + `pad_theme: { colors, css, html }`),
token derivation (3 colors → full family), slot-based HTML chrome, and an in-app editor —
governed by `pad/docs/theme-contract.md`. The two systems are deliberately independent today:

- The deck optimizes for a **single embeddable file** with no storage; designs are files and URLs.
- The Pad is a **served app** with localStorage and a live protocol; designs are manifests in storage.

Convergence point, when it matters: the Pad manifest is a superset of a variant
(`colors ≈ overrides`, `css ≈ style.css`, `html ≈ chrome.html`). A manifest→variant compiler
is mechanical if we ever want one package format.

## Deferred — mapped, not built

- **Studio variant gallery** (`/studio/studies/…`): cards from `themes.json`'s `variants[]`,
  each linking to its live `?variant=` URL. Straightforward once wanted.
- **Variant builder UI**: form → composed override URL.
- **Derivation for variants**: Pad-style "3 colors → accent family + steps" so full recolors
  don't name every token.
- **Second template app**: the catalog shape already supports it; nothing to design until a
  real second layout exists.
- **Native host theming**: the README's planned `--se-* → var(--card)/var(--foreground)`
  aliasing, at which point the host's theme drives the deck and layers 1–2 become authoring
  tools rather than the shipping mechanism.
