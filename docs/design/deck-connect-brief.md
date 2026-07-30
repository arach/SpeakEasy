# Agent brief — connect the SpeakEasy deck end to end

You are picking up a half-built feature. Everything below is the context you need; do not
re-derive decisions that are already made. Your job: take the deck/Pad from demo state to a
real iPad-driving-real-Mac product loop, ending with a stranger able to follow one command
and use it.

## What exists today (verified, do not rebuild)

| Piece | Where | State |
| --- | --- | --- |
| Deck control surface | `deck/index.html` (repo root) | Done. Single-file app, 3 seed themes + URL overrides + file-based variants (`deck/variants/`), catalog `deck/themes.json`. Runs built-in demo data. |
| Deck shipping | `src/cli/deck.ts` | Done. `speakeasy deck` serves it on the LAN with QR + iPad instructions. |
| Pad web app | branch `codex/pad-micro-activity-polish`, `pad/` | Done. Real protocol client: 12 command methods, monotonic revisions, day-pass parsing, reconnect, mock transport. `cd pad && bun run check` must stay green (40 tests). |
| Theme contracts | `pad/docs/theme-contract.md`, `docs/design/deck-design-layers.md` | Done. Read before touching theming. |
| Design studio | `design/studio/` | Done. Presentation only; not part of this mission. |
| Turnkey architecture | `docs/design/speakeasy-pad-turnkey-mvp.md` (in the pad worktree) | The governing doc. Read §Ownership boundaries, §Remote protocol, §Delivery slices. |

## The gap

Nothing on the Mac owns lanes, phases, or playback, and nothing serves the protocol. The
Swift app (`app/Sources/SpeakEasy/`, four files: HUD, history, config) has no lane runtime
and no server. The Pad's live transport has no server to talk to.

## Rules

1. **We ship as an npm package.** `@arach/speakeasy` is the product — users get the deck
   through `npx @arach/speakeasy deck`, not a repo clone. Everything you build must land
   inside the package: server code in `src/` (tsup-compiled like the rest), deck/pad
   assets included via `.npmignore`, and the connected stage delivered as a version bump +
   `npm publish`. No repo-only scripts, no Bun-only entry points in the shipped path.
2. **Protocol boundary is final-shaped.** The wire format is `pad/src/model.ts`
   (`PadCommand`, `PadSnapshot`, `CommandEnvelope`, `CommandAck`). Do not redesign it;
   implement against it. Swift Codable mirror comes later.
3. **Prototype in Bun/TS first** (turnkey doc slice 1 explicitly allows a prototype-grade
   launcher). The final install must not require Node/Bun — the Swift port is a later task,
   and this brief ends with a spec for it, not the port. The prototype may use Bun
   internally for dev speed, but the shipped listener must run under plain Node like the
   rest of the CLI.
4. **The Mac is authoritative.** No success UI without a Mac ack; revisions are monotonic
   and Mac-owned; unknown methods fail explicitly.
5. **Commit hygiene:** gitmoji, imperative, one feature per commit, every commit green
   (`bun run check` in `pad/`, `npm run build` at root). Do not commit without asking.
6. **No scope creep:** no lane editing, no iPad mic streaming, no arbitrary Codex messaging,
   no files/shell/provider keys over the wire (turnkey non-goals).

## Tasks, in order

### 0. Integrate the branches
Commit the uncommitted main-repo work (`deck/`, `design/`, `src/cli/deck.ts`, `.npmignore`,
`docs/design/deck-design-layers.md`) and reconcile with `codex/pad-micro-activity-polish`
so `deck/` and `pad/` live on one branch. Suggested grouping: `✨ add embeddable deck
surface with seed themes`, `✨ add speakeasy deck command with iPad setup flow`,
`✨ add design studio with deck project layout`, `📝 map deck design layers`.

### 1. Domain runtime (prototype, `pad/server/` or `server/`)
A TS module owning the state machine: nine lanes (number, label, taskTitle, canActivate),
active lane, phases exactly as `pad/src/model.ts` declares them, playback state
(elapsed/duration/queue/volume/rate/autoplay/audioLevel), monotonic revision, and
demo-realistic timers (recording → transcribing → submitting → preparingSpeech → speaking).
Seed it from `DEMO_SNAPSHOT`. Speech synthesis goes through the existing SpeakEasy providers
(`src/index.ts`) so narration is real audio from the Mac.

### 2. Coordinator
Projection `runtime → PadSnapshot`, handlers for all 12 methods, `expectedRevision`
checks, idempotency window on `requestId`, acks echoing `requestId` + new revision, and a
`state.changed` push after every mutation. Reuse `pad/tests` fixtures; add server-side
tests with the same fixture shapes.

### 3. Listener (`:8255`, shipped in the package)
Serves `pad/dist` statically and upgrades `/pad` to WebSocket. Lives in `src/` and runs
under plain Node (no Bun APIs in the shipped path; `ws`-style dependency goes in
`dependencies`). Local-pilot day-pass:
mint the fragment from the turnkey doc (`v=1&room&tid&iat&exp&ct&k`), print it + a QR
(reuse the `qrcode` dep), store an HMAC verifier for `k` and the 24h expiry, reject
expired/unknown passes, support revocation and an `End Pad session` action. Reconnect:
full snapshot on `system.hello` before any deltas.

### 4. Prove the loop on a real iPad
`pad/src/transport.ts` already implements the LAN pilot. Serve it, scan the printed QR
with an iPad, Add to Home Screen, and verify: lane activation, hold-to-speak through the
phase machine, narration playback with the deck's transport controls, cancel, and a
revocation. The `speakeasy deck` UX must stay identical — same one command.

### 5. Deck hookup
The deck's host bridge messages (`lane`, `capture`, `playback`, `trace`) map 1:1 onto the
protocol. Either point `deck/index.html` at the same WebSocket when one is offered, or
document the HudsonKit host path. Keep the no-host demo mode intact — `speakeasy deck`
offline must still work.

### 6. Swift port spec (document only)
Write `docs/design/swift-coordinator-port.md`: the `SpeakEasyRemoteCoordinator` surface,
the Codable mirror of `pad/src/model.ts`, listener/DNS-SD requirements from the turnkey
doc, and the fixture suite that proves parity with the Bun prototype.

## Verification (all required before declaring done)

- `cd pad && bun run check` — green, including new server tests.
- `npm run build` — green.
- Fresh shell: `speakeasy deck` → iPad connects, plays, cancels, reconnects after
  backgrounding Safari, and dies cleanly on revoke.
- Every commit green; no built-in theme/layout regressions (screenshot the three seeds +
  oxide variant).
