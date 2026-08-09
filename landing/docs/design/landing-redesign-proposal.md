# SpeakEasy landing page — redesign proposal

Status: proposal, blue-sky. Companion mock: `docs/design/landing-redesign-mock.html` (self-contained; open it in a browser from the repo — audio paths resolve against `public/audio/`).

---

## The argument

The page must argue one thing:

> **Your code can talk. One line installs it, one function speaks it, and you can hear it right now — no key, no signup, no Mac app.**

Every section is a beat in that argument, in this order:

1. **Proof of voice.** The hero doesn't describe the product, it *performs* it. The tagline is rendered as the actual `say("…")` call, and pressing play runs that sentence. The visitor hears the product before reading a second headline.
2. **Proof of breadth.** Five providers, one sentence, played side by side. The difference between system / OpenAI / ElevenLabs / Groq / Gemini is something you *hear*, not a table you read. This is the section no competitor's page can fake, because audio is the product.
3. **Proof of relevance.** The agent-workflow use case — the reason 1,318 people downloaded it this month. A coding agent that *tells you* it's done, via a hook, with zero API keys. This is the emotional hook: not "TTS library" but "your build finished while you were making coffee."
4. **Proof of engineering.** Fallback, cache, priority queue — stated as claims with code evidence, not a six-tile checklist. Three claims, three snippets.
5. **The whole API on one screen.** The closing argument: this is genuinely all of it. SDK and CLI tabs. If the page did its job, this block is the conversion.

SpeakEasy for Codex appears exactly once, as an "Introducing…" banner between the argument and the footer. It is a footnote with a door, not a second hero.

What the page deliberately does **not** do: sell the Mac app, compare pricing, show a feature grid, or use the words "seamless," "powerful," or "next-generation."

## What changes from the current page

| Current | Proposed |
|---|---|
| Library and Codex app fight for the hero | Library owns the page; Codex gets one banner |
| Two near-identical code sections ("Start Speaking in Seconds" / "Get Started in 3 Steps") | One install block in the hero, one full-API block at the end. Nothing repeated |
| "Built for Developers" checklist grid | Three claims with proof, written as sentences |
| Audio is a small "Hear a sample" disclosure | Audio is the organizing principle — hero, voice board, and notification section are all playable |
| Provider list as text | Provider *voice board* — the same sentence in five voices |
| Light pastel gradient, generic shadcn look | Warm paper + ink + one signal color; terminal panels for code |

---

## Section-by-section

### 0. Nav

Minimal, sticky, paper-blur. Left: Silkscreen wordmark `SpeakEasy`. Right: `Docs`, `GitHub`, `npm`, and a single quiet pill: `Introducing Codex →` (links to `/codex/`). No buttons, no CTAs in the nav — the hero handles conversion.

### 1. Hero — "One API. Every voice."

Layout: centered, generous whitespace, max-width ~64rem.

- Eyebrow (JetBrains Mono, small, emerald): `@arach/speakeasy`
- H1 (Spectral, large): **One API. Every voice.**
- Subhead rendered as live code — the tagline is literally the function call:

  ```ts
  await say("Text to speech, with nothing in the way.");
  ```

  Next to it, a real play button (primary, emerald, round) that plays `tagline-demo.mp3`. While playing, a small equalizer animates — the page is "running" the line.
- One line of body (Spectral, ink-70): "A TypeScript text-to-speech library and CLI. macOS system voices, OpenAI, ElevenLabs, Groq, and Gemini behind one function — with automatic fallback, so it always says something."
- Install row: package-manager tabs (`npm` / `pnpm` / `yarn` / `bun` / `npx`) rendering `npm install @arach/speakeasy` (npx tab: `npx @arach/speakeasy "hello"`), with copy button. Under it, two quiet links: `Read the docs` · `Star on GitHub`.
- Small mono stat line: `~1.3k downloads/mo · zero runtime dependencies · Node ≥ 22.12 or Bun`. Downloads number is social proof sized to reality — honest, not inflated.

### 2. The Voice Board — "Hear the difference."

Headline (Spectral): **Five providers. One sentence.**
Subline: "The same words, synthesized five ways. Press play — this is the whole pitch."

Layout: a horizontal row (wraps on mobile) of five voice cards. Each card: provider name (mono), one-line note, play button, and while playing an animated waveform.

- **macOS System** — "Free. No key. Always there." (this is the fallback — card gets a small `fallback` tag)
- **OpenAI** — "tts-1 · nova"
- **ElevenLabs** — "voice IDs · premium"
- **Groq** — "Orpheus · fast"
- **Gemini** — "2.5 Flash TTS"

Below the row, one sentence of fallback logic rendered as code:

```ts
// missing key? rate limit? offline?
// → falls back to the system voice. It always says something.
```

Implementation note: five short clips need recording, one per provider, same sentence ("The same sentence, five different voices."). The mock reuses existing `public/audio/` files as placeholders. Each clip should be ~3s, cached output is fine — that's the product eating its own dog food.

### 3. The Agent Loop — the dark section

This is the only dark section; it reads as a terminal in the middle of the paper page. Full-bleed stone-950 panel.

Headline (Spectral, paper): **Your agent finished ten minutes ago. You were making coffee.**
Subline: "Hook SpeakEasy into Claude Code, Cursor, or Codex and your tools speak a one-line summary when they stop. No API key — the system voice is free."

Left: a hook config snippet (mono, syntax-tinted):

```jsonc
// ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{
      "command": "npx @arach/speakeasy \"$SUMMARY\""
    }]
  }
}
```

Right: three playable notification chips — the actual artifacts in `public/audio/`:

- ▶ "Build completed successfully." (`build-complete.mp3`)
- ▶ "Claude needs your permission." (`permission.mp3`)
- ▶ "Waiting for your input." (`waiting-input.mp3`)

Closing line in the panel (mono, emerald-400): `npx @arach/speakeasy "it works" — try it. that's the install.`

### 4. Three claims, with proof — replaces the feature grid

Headline: **Built like a library, not a landing page.**

Three columns, each a claim stated as a full sentence with a small code excerpt. No icons-in-cards.

1. **It never stays silent.** Automatic fallback walks your provider order — OpenAI down, key missing, offline — and lands on the system voice. `fallbackOrder: ["openai", "groq", "system"]`
2. **It never says the same thing twice.** SQLite cache keyed on text + voice + rate; the second call is a file read. `cache: { enabled: true, ttl: "7d" }`
3. **It knows what matters.** Priority queue with interrupt: an error alert cuts the line, a status update waits its turn. `speak(msg, { priority: "high", interrupt: true })`

Each claim links to the relevant docs page. TypeScript-first and zero-dependency are not separate tiles — they're stated once in the hero stat line, where facts belong.

### 5. The whole API — closing argument

Headline: **That's the entire API.**
Subline: "If you can read this block, you can ship it."

One terminal-style code block, tabs `SDK` / `CLI`:

```ts
import { SpeakEasy } from "@arach/speakeasy";

const speaker = new SpeakEasy({
  provider: "openai",
  openaiVoice: "nova",
  rate: 180,
  cache: { enabled: true },
});

await speaker.speak("Hello, world.");
```

CLI tab shows the equivalent one-liner plus `--out`, `--cache`, `--doctor`. Under the block: primary button `npm install @arach/speakeasy` (copies on click) and secondary `Browse the docs`.

### 6. Codex banner — the tasteful announcement

A single full-width but quiet banner, visually distinct from sections (hairline border, no gradient, no shadow):

> **Introducing SpeakEasy for Codex** — a Mac app and iPad control surface built on this library. Speak to the task you're in; hear the answer come back. `See it →` (`/codex/`)

One sentence, one link. It borrows the library's credibility instead of competing with it.

### 7. Footer

Wordmark, `Docs · GitHub · npm · Codex`, one line: `Made by Arach`. No newsletter, no sitemap farm.

---

## Type direction

Keep the existing trio, but reassign roles with discipline:

- **Silkscreen** — the wordmark *only* (nav + footer). It is a logo, not a typeface; using it for headlines is what makes the current page feel like a hackathon project.
- **Spectral** — all display headlines *and* body prose. This is the opinionated move: a serif for prose gives the page an editorial, written-by-a-person texture that separates it from every Inter-on-white dev-tool page. Spectral at 17–18px with 1.65 line-height reads beautifully.
- **JetBrains Mono** — code, eyebrows, labels, stat lines, buttons that copy commands. The page's second voice.
- No fourth family. (The current `globals.css` quietly maps `--font-display`/`--font-text` to Inter — either commit to Spectral or admit Inter; this proposal commits to Spectral.)

Scale: H1 ~ clamp(2.75rem, 6vw, 4.5rem), section H2 ~ clamp(1.75rem, 3.5vw, 2.5rem), body 1.0625rem. Headlines `font-weight: 300–400` with tight leading; italic Spectral for exactly one word per page at most.

## Color direction

Light, warm, printed — with one dark interruption.

- Paper: `#FBFAF7` (warmer than slate-50; the current blue-green pastel gradient goes away entirely)
- Ink: `#1C1917` (stone-900), secondary ink `#57534E`
- Signal: emerald — keep it, it's the brand's one recognizable hue, but deepen usage to `emerald-700` for text/interactive contrast and reserve `emerald-400` for syntax highlights on dark
- Dark panels (code blocks, the Agent Loop section): `#0C0A09` (stone-950), ink-on-dark `#E7E5E4`
- Hairlines: `#E7E2D9` (warm, not slate-blue)
- No gradients except, optionally, a barely-there radial warmth behind the hero. No glassmorphism pills.

Waveform/equalizer animation in emerald is the only motion motif, repeated at every play button — the page's visual signature. Everything else is still.

## Implementation notes (Next.js + Tailwind + shadcn/ui)

- All of this maps onto existing primitives: `Button`, `Badge`, `Tabs`. The voice board and notification chips are one `PlayButton` component reused four ways — the mock shows the pattern (audio element + play state + equalizer bars).
- Six sections → six components; delete `dual-mode-section`, `download-section`, `features-section`, `quick-start-section`, and fold `code-examples` into the closing API block.
- The five provider clips are static assets generated *with SpeakEasy itself* and committed to `public/audio/providers/*.mp3` — a build script can regenerate them, which is also a nice dogfood story.
- Fonts via `next/font/google` (Silkscreen, Spectral 300/400/500 + italic, JetBrains Mono 400/500), exposed as `--font-silkscreen`, `--font-display`, `--font-mono`.
