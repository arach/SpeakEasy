# SpeakEasy launch control

Status: active launch plan

Updated: 2026-08-02

Canonical product surface: macOS app with browser/PWA Deck

Canonical conversation surface: the user's existing Codex Desktop task

This document is the source of truth for the first public dual-mode release.
It separates what is already proven from what still needs evidence and keeps
the website, installer, release assets, npm package, and Codex plugin on one
versioned launch train.

## Launch decision

Do not promote `0.2.18` to **Latest**.

Use `0.2.18` as the signed self-serve core preview. It proves the exact-task
dictation and response loop, onboarding, Deck runtime, and release installer.
The first public launch should be `0.2.19`, after the default-off completion
observer and ephemeral Luna presenter have passed their real-environment
acceptance run. This preserves the product commitment that opt-in completion
announcements are part of the first version we actively launch, without moving
or silently replacing the existing `v0.2.18` tag or assets.

Steps 1–4 are complete on `master`; steps 5–6 are the remaining public-release
gate. The launch order is:

1. merge and deploy the core onboarding PR;
2. use `0.2.18` for core Mac proof only; its browser/PWA path predates the
   bundled-TLS and pairing-default fix;
3. validate observer/presenter in a signed `0.2.19` candidate;
4. verify the candidate bundles pinned Caddy, defaults pairing on, and fails
   closed rather than downgrade a requested HTTPS launch;
5. publish every `0.2.19` artifact from the same commit and run the full
   clean-machine plus browser/iPad gate against those public assets;
6. promote `0.2.19` to **Latest** and announce it.

## Product truth

SpeakEasy is a voice interface for the Codex task a person is already using.
It does not insert a conversational proxy between the person and Codex.

The primary loop is:

> Speak locally into one exact Codex task. Keep the complete exchange in Codex.
> Hear the real response through a controllable native player.

The retention loop is:

> Opt in to one exact task's future completions. A read-only observer detects a
> proven terminal response; an isolated, ephemeral presenter makes it suitable
> for speech. Neither component can steer or mutate the Codex task.

### Surface roles

| Surface | Role | Public status |
| --- | --- | --- |
| Codex Desktop | Canonical task, transcript, reasoning, and tools | Required |
| SpeakEasy macOS app | Local ASR, exact-task routing, TTS, playback, setup | Primary product |
| Browser/PWA Deck | Remote control for the same live Mac and task lanes | Supported companion |
| Native iPad shell | Native wrapper and discovery test bed | Developer preview |
| TypeScript library/CLI | Provider-independent TTS for apps and hooks | Supported developer product |
| Codex plugin | Agent-operated narration and native player controls | Submission candidate |
| Claude integration | Existing spoken hooks; two-way exact-thread mapping | Expansion, not launch scope |

## Audience and wedge

Primary audience: people doing sustained work in Codex Desktop on an Apple
silicon Mac who want to move between keyboard, voice, and a nearby iPad without
losing task identity or transcript continuity.

Initial wedge:

- long-running coding and research tasks;
- hands-busy or away-from-keyboard review;
- several concurrent Codex tasks that need explicit routing;
- people who want spoken completions without turning every notification into
  noise.

The first launch is intentionally macOS- and Codex-first. Multi-platform
claims, a public native iPad binary, and two-way Claude conversations are not
required to prove this wedge.

## Messaging system

### Category

Voice interface for Codex.

### Master line

**Speak to the Codex task you are already using. Hear its real answer come
back.**

### Supporting line

SpeakEasy combines local dictation, exact-task routing, and controllable
narration across your Mac and iPad without creating a shadow conversation.

### Message pillars

1. **The mapping is the product.** The exact Codex task ID, not focus, title,
   folder, or recency, is the routing authority.
2. **The transcript stays whole.** Dictations and real responses remain in the
   same Codex task; SpeakEasy owns voice and playback, not a second chat.
3. **Local-network by design.** Parakeet transcription stays on the Mac; the
   Apple Speech fallback follows Apple's device capabilities, settings, and
   terms. A browser records on that device and sends a bounded file over
   paired local HTTPS to the Mac's Parakeet model. The native iPad shell can
   use Apple Speech first and uploads its private fallback recording to that
   same Mac. No Arach speech server sits in the path.
4. **Codex installs the companion.** A bounded Codex task can inspect the
   installer and verify checksum, Gatekeeper, Developer ID, and exact version.
5. **Completions are opt-in and quiet.** The observer is read-only; the
   presenter is ephemeral and affects narration only.

### What not to say

- Do not call SpeakEasy a generic voice assistant or autonomous agent.
- Do not imply that an intermediary agent rewrites or relays the user's turn.
- Do not advertise focus-based routing, ambient task discovery, or automatic
  subscriptions.
- Do not claim that the native iPad app is publicly distributed yet.
- Do not describe the private Codex Desktop IPC seam as a supported public API.
- Do not claim observer/presenter is in `0.2.18`; it is not in that signed DMG.
- Do not lead with the TTS package on the Codex product pages.

## Acquisition and activation funnel

| Stage | User action | Product proof | Canonical asset |
| --- | --- | --- | --- |
| Discover | Understand the two-way Codex loop | One exact task, dictation in, real answer out | `/` and `/codex/` |
| Trust | Verify local/canonical architecture | No shadow task; fail-closed identity; signed release | `/codex/`, privacy, `agent.md` |
| Install | Paste one bounded task into Codex | Pinned version and installer integrity checks | `/codex/#codex-install` |
| Activate | Complete Deck readiness and assign a lane | Runtime, Codex, and bridge are actually ready | Settings → Deck |
| Aha | Complete one voice turn | Dictation appears once in the chosen task; response is spoken | Mac or browser/PWA Deck |
| Retain | Subscribe to one task's completions | New terminal response is announced once | `0.2.19` flag-on cohort |
| Expand | Use a second machine or adapt the contract | Same task state on another control surface | browser/PWA; Claude later |

## Launch assets and current state

| Asset | State | Required action |
| --- | --- | --- |
| Dual-mode website and `/codex/` | Live publicly from merged PRs #13 and #18 | Promote the staged `0.2.19` pointers with the launch commit |
| Agent-readable installer guide | Live publicly at `/agent.md` | Promote the staged `0.2.19` runbook with the launch commit |
| Signed/notarized `0.2.18` DMG | Public prerelease | Keep immutable; use as core proof candidate |
| Pinned release installer and checksum | Public prerelease | Run from clean second Mac |
| Native onboarding and Deck | In `0.2.18` prerelease | Complete human permission and device-path checks |
| Secure browser/PWA transport | Merged; signed local app passed paired HTTPS and fail-closed checks | Repeat certificate, pairing, mic, and reconnect on a clean Mac/device |
| Observer/presenter | Merged in PR #14, default-off; signed exact-task/Luna/restart acceptance passed | Complete queue, replay, and invalidation checks on the clean-device candidate |
| npm package | Public `latest` is `0.2.16`; `0.2.19` package source staged | Publish and reinstall-test from the exact launch commit |
| Codex plugin runtime | Rebuilt and isolated-bundle verified as `0.2.19` | Package, publish, and reinstall-test from the exact launch commit |
| OpenAI plugin listing | Submission materials exist | User completes publisher verification and Apps Management Write |
| Native iPad distribution | No TestFlight/App Store artifact | Label developer preview; do not block browser/PWA launch |

## Proof gates

### Core release gate

Run [`self-serve-mac-test.md`](self-serve-mac-test.md) on a Mac with no
SpeakEasy checkout, Bun, Node, Xcode, or previous installation. Record:

- Gatekeeper and Developer ID results;
- microphone, local-network, and certificate permission clarity;
- one real exact-task voice turn with no duplicate or shadow task;
- narration controls;
- reconnect to the same lane from a second device.

### Observer/presenter gate

Against a signed `0.2.19` candidate with `observerPresenter` explicitly
enabled:

1. subscribe to one exact task without making it the active voice lane;
2. complete a turn directly in Codex Desktop;
3. prove it is detected and narrated once, with the full response unchanged in
   the same task;
4. run a completion during an interactive voice turn and prove it queues;
5. restart SpeakEasy and prove the durable cursor prevents replay;
6. mute, complete, inspect the recorded event, then replay manually;
7. invalidate the task and prove the observer fails closed;
8. inspect Codex task history and prove the ephemeral presenter is not visible
   as a resumable task.

The kill switch is `SPEAKEASY_OBSERVER_PRESENTER=0`. A presenter failure must
fall back to the deterministic speech projection, never to a second task.

Local signed acceptance on 2026-08-02 proved exact-task observation, one
durable muted activity with matching task/turn provenance, no duplicate after
restart, a real ephemeral `gpt-5.6-luna` presentation, and mounted-DMG resource
integrity. The clean-device run still owns the interactive-priority, manual
replay, task-invalidation, and public-artifact repetitions above.

### Artifact integrity gate

All public `0.2.19` artifacts must be produced from one commit:

- Git tag and signed/notarized DMG;
- checksum and pinned installer;
- website `releaseVersion` and install prompt;
- `package.json` and npm tarball;
- bundled plugin runtime and submission ZIP;
- release notes and documented requirements.

Publish and verify the GitHub assets, npm package, and plugin bundle before
promoting `0.2.19` to **Latest**. Installation from each public artifact must
be part of the gate; successful local builds are not enough.

Do not update or move `v0.2.18`. If a `0.2.19` candidate fails, fix forward to
a new candidate or version rather than replacing an artifact people may have
already inspected.

## Launch motion

### Private proof

- Run the core gate with the public `0.2.18` prerelease.
- Merge the website/onboarding PR so the install path is reachable.
- Invite a small Apple-silicon/Codex cohort through the pinned install prompt.
- Record failures by first failing step, not by general sentiment.

### Public release

- Cut and notarize `0.2.19` from the exact launch commit.
- Run the clean-machine and observer gates against downloaded public assets.
- Publish npm and the rebuilt plugin bundle.
- Promote `0.2.19` to **Latest**.
- Publish one product demonstration and one technical trust explanation.

### 45-second demonstration spine

1. Show a real Codex task and assign it to a lane.
2. Step away from the keyboard and dictate one precise change from the Deck.
3. Show the same sentence appear in that exact task once.
4. Show Codex work in its normal transcript, then hear the real response.
5. Start a second turn directly in Codex and hear the opt-in completion
   announcement.
6. Close on the task identity and local audio boundary, not on generic AI.

## Measures

The first cohort needs operational evidence, not vanity traffic.

- install completion rate from copied prompt to launched app;
- median time from launch to first assigned lane;
- first exact-task voice-turn success rate;
- duplicate or shadow-task count (target: zero);
- percentage of users who complete a second voice turn;
- completion-subscription enablement and successful once-only announcements;
- permission, certificate, provider, and Codex-version failure counts;
- seven-day retained use among the private cohort.

Do not add hosted telemetry for the first release merely to obtain these
numbers. Use explicit test reports and opt-in cohort interviews until a
privacy-preserving measurement design is approved.

## Ownership and blockers

| Work | Owner | Blocker or next action |
| --- | --- | --- |
| Core website/onboarding deploy | Maintainer/Codex | Merged and verified publicly |
| Clean second-Mac and iPad/browser run | Human tester + Codex | Requires physical clean machine and permissions |
| Observer/presenter candidate | Maintainer/Codex | Merged default-off; local signed acceptance complete, repeat remaining checks on clean device |
| npm publication | Maintainer | Requires npm publish credentials and launch commit |
| Plugin bundle | Maintainer/Codex | Candidate rebuilt and verified; publish and reinstall-test from launch commit |
| OpenAI listing | Account owner | Publisher identity and Apps Management Write |
| Native iPad public distribution | Maintainer | TestFlight/App Store work; intentionally post-launch |

## Rollback

- Website: revert the merge or restore the previous Pages commit; keep the
  direct GitHub release URL available.
- Core app: leave `0.2.17` as Latest until the full launch gate passes.
- Observer/presenter: set `SPEAKEASY_OBSERVER_PRESENTER=0`; persisted
  subscriptions remain inert and reversible.
- Release: never mutate an inspected tag or DMG. Publish a new version.
- Routing: on any Codex protocol or ownership mismatch, disable voice
  submission and show the concrete incompatibility. Never fall back to focus,
  title, or a shadow app-server task.
