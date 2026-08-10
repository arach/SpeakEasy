# Changelog

Notable changes to `@arach/speakeasy`. The npm package, the macOS app, and the
agent skill ship as one train under a single version — see
[`docs/release/0.3.0-release-pass.md`](docs/release/0.3.0-release-pass.md).

## 0.3.0 — unreleased

The first release since `0.2.19` (August 2, 2026). It carries a breaking CLI
change, so it takes a minor bump rather than a patch.

### Breaking

- The `speakeasy codex <sub>` namespace is gone. `speakeasy plugin` is now the
  inventory, and it installs into any supported host. Replace `speakeasy codex
  skill` (and `codex install`) with `speakeasy plugin codex`, and `speakeasy
  codex deck` with `speakeasy deck`.

### Added

- Long text is narrated as ordered segments instead of a single request, using a
  new bounded semantic chunker that splits on meaning rather than a byte count.
- `speakeasy uninstall` genuinely removes what SpeakEasy installed. It only
  touches paths SpeakEasy created — anything belonging to another tool is left
  alone.
- `speakeasy plugin` with no host lists every host it can install into.

### Fixed

- Codex replies are no longer clipped to 600 characters before narration. Long
  replies were being silently truncated mid-sentence.
- Deck turns route through canonical Codex tasks, so the task selected on the
  Deck is the task that activates.
- Canonical IPC is preserved across Deck navigation instead of being rebuilt,
  and task IPC is kept warm — both remove a stall on the first interaction.
- A finished narration restarts at its first segment rather than resuming
  part-way through.

### Changed

- Filesystem paths are centralized, so the cache, config, and history locations
  come from one place instead of being rebuilt at each call site.
- Deck catalog and playback helpers are consolidated.
- The install surface is narrower: the published tarball ships `dist/` only, and
  `dist/` is no longer tracked in git. The Deck surface is no longer bundled
  with the npm package — `speakeasy deck` fetches it into
  `~/.config/speakeasy/deck` on first run, and the Mac app keeps using its own
  bundled copy.

### Site

- The approved design mocks are now the live home and Pad pages, rendered
  directly from `landing/mocks/` rather than re-implemented as components.
