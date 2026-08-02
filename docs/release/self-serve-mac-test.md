# Self-serve release test — second Mac

Use this first to validate the public SpeakEasy 0.2.18 core prerelease, then
repeat it against the exact 0.2.19 launch candidate before promotion. The test
Mac should not have the SpeakEasy repository, Bun, Node, Xcode, or a prior
SpeakEasy installation.

Do not promote 0.2.18 to **Latest**. It is the immutable core proof candidate;
the first public launch is 0.2.19 after the observer/presenter gate in
[`gtm.md`](gtm.md) also passes.

## Before starting

- Apple silicon Mac running macOS 14 or newer
- current Codex Desktop installed and signed in
- both Macs and the iPad/browser on the same Wi-Fi for Deck testing
- no SpeakEasy process running and no `/Applications/SpeakEasy.app`

## Install with Codex, without developer tools

1. Open the SpeakEasy website at `/codex/#codex-install`.
2. Copy the pinned installation prompt into a new Codex task on the test Mac.
3. Let Codex download and inspect `install-speakeasy.sh`, then approve running
   the inspected local file.
4. Watch Codex report the checksum, Gatekeeper, Developer ID, version, and
   `/Applications` replacement checks.
5. Confirm SpeakEasy opens directly to **Settings → Deck**.

Pass criteria:

- Codex uses the exact `0.2.18` asset—not a floating latest release—and does not
  use a `curl | sh` shortcut.
- The published SHA-256, Gatekeeper assessment, bundle ID, Developer ID team,
  and exact app version all pass before `/Applications` changes.
- Gatekeeper accepts the app normally—no **unidentified developer** warning,
  quarantine bypass, or right-click workaround.
- SpeakEasy appears in the menu bar.
- The app does not request Bun, Xcode, Node, a repository, or a terminal step.
- The app bundle contains its signed Caddy helper; no Homebrew or separate
  server install is requested.
- Codex clearly separates completed machine checks from the microphone and
  local-network prompts that require the user.

If the Codex path fails, record the exact failing check before using the manual
fallback: download `SpeakEasy.dmg`, drag it to Applications, and open the app.

## Complete guided setup

1. Open **SpeakEasy → Settings → Deck**.
2. Confirm **SpeakEasy runtime** and **Codex** are checked.
3. Press **Start Deck**.
4. Wait for the status, lanes, QR code, and device URL.

Pass criteria:

- A missing prerequisite is named in its own checklist row.
- A failure leaves an actionable message and **Open log** button.
- The device URL is not shown until the runtime snapshot answers.
- Restarting SpeakEasy does not create duplicate Deck or Caddy processes.
- Pairing is on before the first start, and startup fails with an actionable
  error instead of publishing an HTTP device link when HTTPS cannot start.

## Exercise one real voice turn

1. Assign a lane to this Codex task.
2. Hold to speak and dictate a unique, harmless sentence.
3. Release to send.
4. Watch the same sentence appear in the selected Codex task.
5. Wait for the real response and replay its narration.

Pass criteria:

- the dictation appears exactly once in the selected task;
- no shadow or duplicate Codex conversation is created;
- the full task transcript remains visible in Codex;
- narration comes from the configured system/OpenAI/ElevenLabs voice;
- replay, stop, speed, and volume operate on the returned audio.

## Exercise the device path (`0.2.19` only)

Do not run this section against `0.2.18`; its device path predates the bundled
TLS and pairing-default fix.

1. From the Mac's Deck settings, copy the one-time certificate trust link.
2. On the iPad, open that HTTP bootstrap link, install the local Caddy profile,
   then enable **Caddy Local Authority** in **Settings → General → About →
   Certificate Trust Settings**.
3. Only after trust is enabled, scan or open the paired HTTPS Deck link.
4. Select the same lane and confirm its project, branch, and recent activity.
5. Complete another hold-to-speak turn, then add the Deck to the Home Screen.

Pass criteria:

- the device sees the same live lane and activity state as the Mac app;
- the device URL is `https://`, contains a pairing token in its fragment, and
  hold-to-speak can obtain microphone permission in the secure context;
- an unpaired copy of the URL cannot read snapshot, audio, or WebSocket data;
- dictation and responses remain synchronized with the real Codex task;
- reconnecting the page resumes the same lane rather than creating a new one.

## Report

Record:

- macOS and Mac model;
- Codex Desktop version;
- whether Gatekeeper, microphone, local-network, and certificate prompts were
  clear;
- the first failing step, screenshot, and `~/.config/speakeasy/deck.log` if a
  step fails.

Record the 0.2.18 result as core evidence. Before promoting 0.2.19 to
**Latest**, update the pinned version in this checklist and repeat every step
against the downloaded public 0.2.19 assets.
