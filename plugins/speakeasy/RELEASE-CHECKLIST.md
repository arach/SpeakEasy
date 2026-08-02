# SpeakEasy plugin release checklist

Last audited: July 24, 2026

The submitted skill installs the latest GitHub release, so the native app release must land before
the plugin is sent for review. Do not submit while `v0.2.16` is still latest: that release predates
the permanent menu-bar player and live HUD.

## 1. Local source and skill bundle

- [x] `bun run build`
- [x] `bunx tsc --noEmit`
- [x] `bun run test:privacy`
- [x] Plugin and skill schema validators pass.
- [x] `bun run package:plugin-submission` produces a versioned ZIP and SHA-256 file under `dist/`.
- [x] The extracted ZIP runs without a global `speakeasy` command or repository dependencies.
- [x] The installed personal-marketplace copy renders non-empty system speech from `/tmp`.
- [x] Generated narration is mode `0600`; local cache and history directories are mode `0700`.
- [x] The submission ZIP contains no common API-key patterns.

Submission artifact for 0.1.0:

```text
dist/speakeasy-skill-0.1.0.zip
dist/speakeasy-skill-0.1.0.zip.sha256
```

## 2. Native application release

- [x] Merge [PR #2](https://github.com/arach/SpeakEasy/pull/2). It landed on `master` as
      `19acdf1570cffd6c2e1dae1aa4daa3af2b614147` after all checks passed.
- [x] The PR branch passes a clean `swift build -c release` and all four release-mode Swift tests.
- [x] A fresh unsigned `0.2.17` DMG mounts with the expected bundle ID, version, arm64 executable,
      four Hudson frameworks, and byte-identical packaged executable.
- [x] The installer-hardening patch applies cleanly to the PR branch.
- [x] The hardened bundle layout removes duplicate physical framework copies from
      `Contents/MacOS`, reducing the app bundle from 34 MB to 20 MB. The resulting app launches,
      serves player status, signs with Developer ID team `2U83JFPW66`, and passes deep strict
      signature verification.
- [x] `Info.plist`, the Swift package deployment target, and the plugin listing consistently require
      macOS 14 or newer.
- [x] Developer ID Application identity for team `2U83JFPW66` is valid in the signing Keychain.
- [x] Fix the HudsonKit XCFramework builder so each module owns its implementations and downstream
      modules dynamically link their dependencies. The `codex/fix-xcframework-duplicate-classes`
      branch produces universal `arm64`/`x86_64` artifacts with clean ownership checks. SpeakEasy
      builds, passes all four Swift tests, bundles the four frameworks, and launches without any of
      the six HudsonKit 0.3.2 duplicate-class warnings.
- [x] Publish the corrected HudsonKit XCFramework package as `0.3.3` and update SpeakEasy's
      dependency and lockfile from `0.3.2`. A clean build, all six Swift tests, the live player IPC
      check, and a second-instance stderr scan pass against the hosted artifacts with zero
      duplicate-class warnings. Repeat signing/notarization from the final merged revision below.
- [x] The `notarytool-air` Keychain profile is available and authenticated; `notarytool history`
      succeeds without exposing credentials. Continue to use interactive password entry when the
      profile must be recreated; never pass the app-specific password on a shell command line.
- [x] A macOS 14 integration candidate was Developer ID signed, submitted as
      `288e22e8-05e4-4e2b-9139-60719e9b86ae`, accepted by Apple, stapled, and accepted by
      Gatekeeper. Its mounted app reports version `0.2.17`, minimum macOS `14.0`, team
      `2U83JFPW66`, the expected four frameworks, no framework copies under `Contents/MacOS`, and
      a packaged executable hash identical to the signed source app. This is proof of the combined
      release path only; rebuild from the merged revision before publishing.
- [x] Build the final `0.2.17` release DMG from the exact tree merged by
      [PR #3](https://github.com/arach/SpeakEasy/pull/3) as
      `253a09e064c6536f5df8e7670749d6450e451842`. Apple accepted submission
      `30d199cd-405a-454f-94cd-5b70f0933c15`, and the ticket was stapled successfully.

  ```bash
  app/tools/release/build-dmg.sh <version>
  ```

- [x] Verify the final artifact independently with `codesign`, `stapler`, and Gatekeeper. The DMG
      was accepted as a notarized Developer ID release.

  ```bash
  codesign --verify --verbose=2 app/dist/SpeakEasy.dmg
  xcrun stapler validate app/dist/SpeakEasy.dmg
  spctl --assess --type open --context context:primary-signature --verbose=4 app/dist/SpeakEasy.dmg
  ```

- [x] Mount the DMG through the hardened installer and run deep strict signature verification on
      `SpeakEasy.app`. The installed app reports version `0.2.17` and team `2U83JFPW66`.
- [x] Publish [SpeakEasy 0.2.17](https://github.com/arach/SpeakEasy/releases/tag/v0.2.17) with both
      `SpeakEasy.dmg` and `SpeakEasy-0.2.17.dmg`.
- [x] Confirm the GitHub `releases/latest` endpoint resolves to `v0.2.17` and both assets share
      SHA-256 `93fe90fbdd5599ade46469a8a6af40b4d00da1c1950447dab0144b1e45f5b014`.
- [x] Install through the bundled skill runtime. It upgraded the local app from `v0.2.7` to
      `v0.2.17`, passed the signed/notarized DMG and expected-team checks, relaunched from
      `~/.speakeasy/SpeakEasy.app`, and returned a healthy player status.

## 3. Public website and policies

- [x] Privacy, terms, and support routes build in the production Next.js export.
- [x] Merge and deploy the legal-site changes in
      [PR #3](https://github.com/arach/SpeakEasy/pull/3). The corrected player/download narrative
      followed in [PR #4](https://github.com/arach/SpeakEasy/pull/4).
- [x] Confirm each URL returns HTTP 200 publicly:

  ```text
  https://speakeasy.arach.dev/
  https://speakeasy.arach.dev/support/
  https://speakeasy.arach.dev/privacy/
  https://speakeasy.arach.dev/terms/
  ```

The homepage now links directly to the stable signed DMG and shows the real native player. The
support, privacy, and terms pages all returned HTTP 200 after the production Pages deployment.

## 4. OpenAI Platform submission

- [x] Sign in to the OpenAI Platform organization that will own the listing.
- [ ] Confirm a verified individual or business identity that matches the public listing.
- [ ] Confirm the submitter has `Apps Management: Write`.
- [ ] Create a **Skills only** submission draft.
- [ ] Copy the listing, starter prompts, availability, release notes, and five positive plus three
      negative tests from `SUBMISSION.md`.
- [ ] Upload the final `dist/speakeasy-skill-0.1.0.zip` and retain its checksum with the release
      records.
- [ ] State the macOS/Bun/native-player prerequisites prominently for reviewers and users.
- [ ] Complete policy attestations only after the native release and all public URLs are live.
- [ ] Run every reviewer fixture once against the exact uploaded ZIP, then submit for review.

Current external blocker: the `Personal` OpenAI Platform organization shows both Individual and
Business publisher verification as not started. The signed-in submitter is the organization Owner,
but a publisher identity must be completed by the user before the skills-only submission can be
created or sent for review.
