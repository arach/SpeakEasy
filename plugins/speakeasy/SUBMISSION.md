# SpeakEasy directory submission

## Listing

**Name:** SpeakEasy

**One-line description:** Give your agents a controllable voice through a native macOS menu-bar
player.

**Long description:** SpeakEasy turns summaries, drafts, updates, and any selected text into speech,
then plays it through a permanent native macOS menu-bar player. Start with the built-in system voice
or use a configured OpenAI, ElevenLabs, Groq, or Gemini provider. Autoplay or queue audio, pause and
resume, scrub, change volume or playback speed, follow the words in a live HUD, and jump back to the
originating Codex task.

**Category:** Productivity

**Initial country availability proposal:** Canada, United States, United Kingdom, Ireland,
Australia, and New Zealand. Expand after validating localized support and legal requirements.

**Platform availability:** macOS 14 or newer; Codex desktop and ChatGPT Work surfaces that provide
a compatible macOS host for local skill scripts. The native menu-bar player is not available on
macOS 13 or older, Windows, Linux, iOS, Android, or a browser-only host.

**Website:** https://speakeasy.arach.dev

**Support:** https://speakeasy.arach.dev/support/

**Privacy:** https://speakeasy.arach.dev/privacy/

**Terms:** https://speakeasy.arach.dev/terms/

## Starter prompts

1. Read this summary aloud in SpeakEasy.
2. Queue a spoken update and autoplay it.
3. Show the current SpeakEasy player status.

## Review prerequisites

- A Mac running macOS 14 or newer and capable of running the current signed SpeakEasy application.
- Bun 1.0 or newer on `PATH`.
- No provider account is required for the default macOS system voice.
- Optional cloud-provider tests require the reviewer to configure their own provider credentials.

## Positive invocation tests

1. **Prompt:** “Read this summary aloud in SpeakEasy.”
   **Fixture:** A Mac with Bun and the signed SpeakEasy app; the prompt includes a two-sentence
   summary. No cloud-provider account is required.
   **Expected behavior:** The skill renders the supplied summary with the system voice, connects to
   the native player, and autoplays it.
   **Expected result shape:** A brief confirmation naming the queued title; player status reports a
   current item containing the supplied text and a playing state.
2. **Prompt:** “Queue this update in SpeakEasy without playing it yet.”
   **Fixture:** A Mac with Bun and the signed SpeakEasy app; the prompt includes one sentence of
   update text.
   **Expected behavior:** The audio is generated and added with autoplay disabled.
   **Expected result shape:** A short queued confirmation; player status remains idle and the queue
   contains exactly one item whose text matches the update.
3. **Prompt:** “Pause SpeakEasy, set playback to 1.25×, then resume.”
   **Fixture:** A narration item is already playing in the signed SpeakEasy app.
   **Expected behavior:** The controller pauses, changes the live rate, and resumes without
   regenerating audio.
   **Expected result shape:** A concise confirmation; player status reports `playbackRate: 1.25`
   and a playing state for the same item ID.
4. **Prompt:** “What is SpeakEasy playing right now?”
   **Fixture:** One item titled “Quarterly summary” is playing and one item is queued.
   **Expected behavior:** The skill requests player status without changing playback.
   **Expected result shape:** A short status summary naming “Quarterly summary,” its playing state,
   current playback rate, and the queued-item count.
5. **Prompt:** “Use the macOS system voice to narrate this note.”
   **Fixture:** A Mac with Bun and the signed SpeakEasy app; no cloud-provider credentials are
   configured; the prompt includes a short note.
   **Expected behavior:** Generation uses the macOS system provider and never requests a cloud
   credential.
   **Expected result shape:** A brief queued or playing confirmation; the item provider is `system`
   and the audio file is non-empty.

## Negative invocation tests

1. **Prompt:** “Fix the failing TypeScript tests in this repository.”
   **Expected behavior:** SpeakEasy is not invoked.
   **Expected result shape:** The coding task proceeds with repository tools and no narration is
   generated or queued.
   **Why:** The prompt requests code changes, not narration or a player action.
2. **Prompt:** “Play this YouTube video.”
   **Expected behavior:** SpeakEasy is not invoked; the assistant clarifies that it cannot play
   general media when no suitable media tool is available.
   **Expected result shape:** A clarification or safe alternative with no SpeakEasy queue change.
   **Why:** SpeakEasy is a text-to-speech narration player, not a general media player.
3. **Prompt:** “Transcribe this meeting recording.”
   **Expected behavior:** SpeakEasy is not invoked; the request is routed to a transcription
   capability if one is available or clarified otherwise.
   **Expected result shape:** A transcription-oriented response with no generated speech or player
   queue change.
   **Why:** SpeakEasy generates speech from text and does not perform speech recognition.

## Review checks

- Run `bun run package:plugin-submission` from the repository root and upload the resulting
  `dist/speakeasy-skill-0.1.0.zip` file in the portal.
- The plugin manifest and skill frontmatter pass the plugin and skill validators.
- The bundled runtime renders a non-empty file without relying on a global `speakeasy` executable.
- A ZIP containing only the final `speakeasy/` skill directory renders audio after extraction,
  proving every referenced runtime dependency is inside the submitted skill bundle.
- The native application downloaded by the runtime passes `codesign`, Gatekeeper assessment, and
  notarization staple validation.
- The player controller can enqueue, inspect, pause/resume, change rate, and clear the test item.
- Privacy, terms, support, website, repository, and screenshot links resolve publicly.

## Release notes — 0.1.0

- Initial skills-only SpeakEasy plugin.
- Bundled local runtime with zero-configuration macOS system speech.
- Signed native menu-bar player installation and control.
- Autoplay, queueing, transport controls, scrubbing, volume, playback speed, live transcript HUD,
  and Codex task return support.

## Portal prerequisites outside the repository

- Submit from an OpenAI Platform organization whose publisher identity is verified and matches
  “Arach,” the public website, and the policy URLs.
- The submitter must have `Apps Management: Write` for that organization.
- The website, support, privacy, and terms URLs must be deployed and publicly reachable before
  review.
