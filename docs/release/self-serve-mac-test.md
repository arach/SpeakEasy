# Self-serve release test — second Mac

Use this as the promotion gate for SpeakEasy 0.2.18. The test Mac should not
have the SpeakEasy repository, Bun, Xcode, or a prior SpeakEasy installation.

## Before starting

- Apple silicon Mac running macOS 14 or newer
- current Codex Desktop installed and signed in
- both Macs and the iPad/browser on the same Wi-Fi for Deck testing
- no SpeakEasy process running and no `/Applications/SpeakEasy.app`

## Install without developer tools

1. Open the SpeakEasy website and download `SpeakEasy.dmg`.
2. Confirm Safari or the browser completes the download without a warning.
3. Open the DMG and drag SpeakEasy to Applications.
4. Launch SpeakEasy from Applications.

Pass criteria:

- Gatekeeper opens the app normally—no **unidentified developer** warning and
  no right-click workaround.
- SpeakEasy appears in the menu bar.
- The app does not request Bun, Xcode, Node, a repository, or a terminal step.

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

## Exercise the device path

1. Open the QR/device link from another Mac on the same Wi-Fi.
2. Select the same lane and confirm its project, branch, and recent activity.
3. Complete another hold-to-speak turn.
4. If using an iPad, install and trust the local Caddy certificate once, then
   add the Deck to the Home Screen.

Pass criteria:

- the device sees the same live lane and activity state as the Mac app;
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

Promote the GitHub prerelease to **Latest** only after all pass criteria above
are satisfied on the second Mac.
