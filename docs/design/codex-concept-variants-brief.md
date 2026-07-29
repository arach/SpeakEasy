# SpeakEasy × Codex independent visual concept brief

Status: build brief  
Date: 2026-07-29  
Audience: Kimi and Grok

## Assignment

Create two independent visual studies for how SpeakEasy should tell its new
Codex story. Kimi and Grok receive this exact same brief, work independently,
and each own one page:

- **Kimi:** `landing/app/codex/concepts/kimi/page.tsx`
- **Grok:** `landing/app/codex/concepts/grok/page.tsx`

Do not coordinate on a shared aesthetic. The value of this exercise is seeing
two genuinely different visual instincts applied to the same product truth.

Each page must contain **three distinct, fully rendered variations** on that
agent's concept. These are not mood-board captions. A visitor should be able to
see and understand each variation as a credible hero/storytelling direction.
Use a clear on-page selector, anchored index, or thoughtfully stacked sequence
so all three are easy to compare.

## The story every variation must communicate

SpeakEasy is now a two-way voice layer for Codex on the Mac:

1. **Listen / ASR:** a deliberate utterance is transcribed locally.
2. **Exact task:** SpeakEasy routes the transcript to the Codex task the user
   explicitly chose. Task identity—not title, recency, folder, or window
   focus—is the authority.
3. **Real conversation:** Codex owns and continues the actual task; SpeakEasy
   does not create a shadow conversation.
4. **Speak / TTS:** the task's real response returns through SpeakEasy's native
   menu-bar player, with queue, playback, speed, volume, HUD, and a path back to
   the originating task.

The shortest articulation is:

> **Speak to Codex. Hear it answer.**

Supporting proof:

- Nine persistent task lanes: `⌘⌥1` through `⌘⌥9`.
- `⌃⌥Space` begins and ends one utterance for the active lane.
- Routing is explicit, inspectable, and fail-closed. SpeakEasy never guesses
  based on focus.
- Local transcription; system narration works without a cloud voice account.
- Codex is the first deep two-way integration. Claude hooks already provide
  one-way spoken notifications; the same two-way contract is intended for
  Claude next.

## Product boundaries that must remain honest

- The signed SpeakEasy **0.2.17** player/TTS release is available now.
- Exact-task Codex listening is an opt-in **technical preview** merged on
  `master`; it currently requires a source build and uses a private,
  version-checked Codex Desktop IPC seam.
- Do not present the private bridge as a supported public Codex API.
- Do not claim that the 0.2.17 DMG includes the listening preview.
- The Codex plugin is packaged, but public directory listing is still in
  progress.
- Do not claim two-way Claude support today.

The fuller product narrative is in
`docs/design/dual-mode-website-narrative.md`. Treat it as supporting context;
this file is the shared assignment.

## Visual direction

The existing SpeakEasy site is intentionally light, precise, and elegant:
white and soft-slate surfaces, emerald/blue accents, generous space, restrained
glass, strong typography, and quiet motion. The previous wholesale dark-site
experiment was rejected as less beautiful and harder to understand.

Explore boldly **inside that quality bar**. Each concept page may have its own
visual system, metaphor, illustration made from HTML/CSS, typographic rhythm,
and interaction. It may use isolated dark moments when the concept requires
them, but do not turn the exercise into a generic neon-on-black developer site.

Potential raw material—not a required checklist:

- a voice waveform becoming an addressable task lane;
- two synchronized modes orbiting one persistent conversation;
- a routing diagram where identity remains attached to every turn;
- a native-player transport paired with a deliberate microphone control;
- the keyboard lane grid as a memorable signature;
- a visible bridge from Codex now to Claude next.

Choose a strong point of view. Avoid generic gradient cards, feature-icon
grids, fake terminal overload, dashboard chrome, and decorative complexity that
does not clarify the interaction.

## Build requirements

- Work only in the page assigned to your identity and, if necessary, a sibling
  component folder beneath that same route. Do not edit the other concept, the
  concept index, shared navigation, global CSS, Tailwind config, dependencies,
  or existing `/codex` page.
- Reuse the current Next.js, React, Tailwind, and Lucide stack. Add no packages.
- Keep the page self-contained and compatible with the repository's static
  export.
- Include a clear route back to `/codex/`.
- Make the three variations complete enough to review at desktop and mobile
  widths. Accessibility, readable contrast, semantic structure, and reduced-
  motion-safe behavior matter.
- Use real product language from this brief. Do not introduce unsupported
  commands, prices, testimonials, integrations, or release claims.
- Do not commit. The integrating agent will review, test, and commit the two
  pages together.

## Completion report

When finished, reply in the Scout channel with:

1. the route you built;
2. the names and one-sentence premise of your three variations;
3. changed files;
4. checks run and any blockers.
