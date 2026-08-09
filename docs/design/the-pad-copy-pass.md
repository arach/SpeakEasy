# THE PAD landing — copy edit pass (tone)

Scope: **text only**. No CSS, colors, layout, spacing, or structure changed.
Files touched: `landing/mocks/pad.html` (then at `docs/design/the-pad-landing-mock.html`),
`docs/design/the-pad-landing-proposal.md`.

Goal, in the owner's framing: "just be like, hey, here's a pad you can control
your thing with." Confident and plain, peer to peer. Visual design left alone.

---

## 1. Changes in `pad.html`

### Hero

| Before | After |
| --- | --- |
| `Nine Codex tasks. / One surface you talk to.` | `A pad for the Codex tasks / you're already running.` |
| `THE PAD turns an iPad into a hardware-feeling control surface for the agent conversations you already have running. Hold, speak, hear the real answer — no laptop in your lap.` | `It runs on an iPad as a web app, with nine lanes — one Codex task each. Hold the bar to talk to a lane, and the reply gets read back to you.` |
| lane-1 pad snippet: `Received live on lane 1 in the exact Codex task.` | `Arrived on lane 1, in the Codex task that lane is bound to.` |

Why: the headline was two stacked fragments doing drama. "Hardware-feeling
control surface for the agent conversations" is three abstractions in a row;
the replacement says what it is (iPad, web app, nine lanes) and what you do.
"No laptop in your lap" told the reader how to feel about it.

### Section 2 — the argument

| Before | After |
| --- | --- |
| label `THE PROBLEM YOU ALREADY HAVE` | `WHAT IT'S FOR` |
| `Your agents don't need / another window. / They need a channel strip.` | `Every running task / gets its own key. / All nine on one screen.` |
| `MIXER LOGIC — EVERY RUNNING TASK IS A LANE. YOU ARE THE ENGINEER.` | `ONE LANE PER TASK — NINE ON THE PAD, TWELVE ON THE MICRO DECK.` |

Why: "the problem you already have" presumes the reader's state. The old H2 was
the page's biggest manifesto moment (negation → dramatic reveal). "YOU ARE THE
ENGINEER" is the reader being told who they are. The replacement kicker is a
verifiable spec line instead.

### Section 3 — lanes

| Before | After |
| --- | --- |
| label `LANES, NOT SHORTCUTS` | `WHAT A LANE HOLDS` |
| `A pad is not a macro key. / It's a lane.` | `Each key holds a task, / not a macro.` |
| `Each of the nine pads is bound to one exact Codex task — the project, the git branch, the last exchange, and the live state, all visible at arm's length. The task ID is the routing authority: not whichever window happens to be focused, not the most recent title, not a guess.` | `Each of the nine keys is bound to one exact Codex task, and shows the project, the git branch, the last exchange, and whether that task is live, idle, or queued. Routing is by task ID, so nothing depends on which window is focused or what the most recent thread is called.` |
| `01 Exact task ID is the address. Every activation revalidates the binding with Codex Desktop.` | `01 The task ID is the address. Each send revalidates the binding with Codex Desktop first.` |
| `02 Fail closed. If the task can't be proven, the lane goes dark instead of rerouting your words.` | `02 It fails closed. If the binding can't be verified, the send stops — it won't pick a different task.` |
| `03 State at a glance. Live, idle, queued — like meters on a mixer, not badges on a dashboard.` | `03 State is on the key. Live, idle, or queued, readable without opening anything.` |
| bigpad snippet: `… — received live on lane 1 in the exact Codex task.` | `… — arrived on lane 1, in the Codex task that lane is bound to.` |

Why: "routing authority", "at arm's length", "not a guess", "the lane goes
dark", "meters on a mixer, not badges on a dashboard" — all doing atmosphere.
The routing facts (exact task ID, revalidation, fail-closed) survive verbatim in
substance, just stated as behavior.

### Section 3b — Micro Deck

| Before | After |
| --- | --- |
| `More than nine tasks? / Go denser.` | `More than nine tasks? / Use the 4×4.` |
| `The Micro Deck is a programmable 4×4 bank with the same binding model — every key is still one exact task, still fail-closed, still labeled. Transport lives on the bottom row. Sixteen lanes, one thumb.` | `The Micro Deck is a 4×4 key bank with the same binding model: one exact task per key, same fail-closed check. The bottom row is transport, which leaves twelve lanes.` |

**Factual fix, not just tone:** the old copy said "Transport lives on the bottom
row" and then "Sixteen lanes" in the same paragraph. 4×4 minus a transport row
is **twelve** lanes, which is what the mock's own key grid shows (D1–D4 are
RPLY / STOP / AUTO / ACTV). The section-2 kicker now says twelve too. If the
real design gives transport its own hardware and keeps sixteen bindable keys,
this is the one number to send back.

### Section 4 — hold to speak

| Before | After |
| --- | --- |
| `Say it to the lane, / not to the cloud.` | `The transcription / happens on the iPad.` |
| `Hold the bar and talk. Parakeet transcribes on-device via Core ML — nothing is uploaded, no speech server sits in the path — and the final text enters the exact task bound to that lane. Once.` | `Hold the bar and talk. Parakeet runs on the device through Core ML, so the audio isn't uploaded anywhere and there's no speech server in the path. Let go and the transcript is sent once, to the task bound to that lane.` |

Why: the old H2 is a cloud-vs-local applause line, and it's also slightly
untrue as written — the text does leave the iPad, it goes to your Mac. The new
H2 states the part that is actually true and is the thing people care about.
"Once." as a one-word sentence was the most manifesto-shaped punctuation on the
page; the delivery guarantee is preserved in the sentence and in the spec line
under the bar (`DELIVERY: EXACTLY ONCE`, unchanged).

### Section 5 — anatomy

| Before | After |
| --- | --- |
| `Everything is labeled. / Nothing is hidden.` | `What the controls do.` |
| `01 Encoder — Narration volume. Press once to pause the voice, not the task.` | `Narration volume. Press it to pause playback; the task keeps running.` |
| `02 Speaker grille — Status voice — binds, confirms, errors. Playback routes to your speakers or headphones.` | `Status voice for binds, confirmations, and errors. Playback goes to your speakers or headphones.` |
| `03 Status LEDs — Bridge, mic, queue depth. If the bridge LED is dark, the surface says nothing.` | `Bridge, mic, and queue depth. If the bridge LED is dark, the Mac isn't connected and sends won't go through.` |
| `04 Lane pads ×9 — One exact Codex task each. Project, branch, last exchange, live state.` | `One exact Codex task each, with its project, branch, last exchange, and state.` |
| `06 Hold to speak — Momentary. On-device Parakeet ASR. Release sends — exactly once, to the bound task.` | `Momentary button, on-device Parakeet ASR. Releasing it sends the transcript once, to the bound task.` |

Why: the flagged line. Two absolutes ("everything", "nothing") in one headline,
neither verifiable, over a section that is literally a labeled diagram — so the
headline can just name the section. "The surface says nothing" was poetic where
"the Mac isn't connected and sends won't go through" is the actual consequence.
Item 05 (transport) was already a plain enumeration and is unchanged.

### Section 6 — signal path

| Before | After |
| --- | --- |
| label `ONE COMPLETE TURN` | `ONE TURN, END TO END` |
| `ASR and TTS meet around the same task. There is no shadow agent and no second conversation to reconcile later.` | `Dictation and narration both attach to the same Codex task, so there's no second conversation to merge back in later.` |
| `NO SHADOW CONVERSATION` / `Dictation and the real response stay in the same Codex task. SpeakEasy owns voice and playback — never a second chat to reconcile.` | `SAME CONVERSATION` / `Your dictation and Codex's reply stay in the same task. SpeakEasy handles voice and playback; it doesn't run a conversation of its own.` |
| `NO FOCUS GUESSING` / `The exact task ID — not title, recency, folder, or window focus — is the routing authority. If it can't be proven, the send stops.` | `ROUTED BY TASK ID` / `Sends are addressed by exact task ID, not by title, recency, folder, or window focus. If the binding can't be verified, the send stops.` |
| `NO SPEECH LOST` / `Durable queues survive relaunch. What you said arrives once, in order, even if the surface went to sleep in between.` | `DURABLE QUEUE` / `The queue is on disk, so it survives a relaunch. What you said arrives once, in order, even if the iPad slept in between.` |

Why: three `NO ___` headers stacked in a row is the manifesto cadence in its
purest form, and "never" was doing work it couldn't cash. Retitled to what each
one *is* rather than what it isn't; every underlying guarantee is intact and now
reads as a spec table. The five chain nodes (`HOLD → TRANSCRIBE → ROUTE → CODEX
REPLIES → NARRATE`) are unchanged.

### Section 7 — player

| Before | After |
| --- | --- |
| label `THE ANSWER COMES BACK` | `PLAYBACK` |
| `Through a real player, / not a notification.` | `Answers come back / as audio you can scrub.` |
| `Scrub the response, change the speed, replay the last exchange with RPLY, or let AUTO narrate completions as tasks finish. The full text always stays in Codex — this is simply the best way to hear it while your hands are somewhere else.` | `Scrub the reply, change the speed, replay the last exchange with RPLY, or turn on AUTO to have completions narrated as tasks finish. The full text is still in Codex; this is for when you'd rather listen than read.` |

Why: "a real player, not a notification" is defensive, and "the best way to hear
it" and "always" are both unearned. Dropped "while your hands are somewhere
else" — that's the reader's business.

### Section 8 — themes

| Before | After |
| --- | --- |
| `The surface is skinnable. / The instrument is the same.` | `Five themes, / same layout.` |
| `Tap a finish to repaint this entire page — the same token system the deck itself uses.` | `Tap one to repaint this page. It's the same CSS token set the deck itself uses.` |

### Section 9 — spec plate

| Before | After |
| --- | --- |
| `HOW YOU GET IT` | `HOW YOU INSTALL IT` |
| `… behaves like an app — full screen, no browser chrome, on the coffee table where it belongs.` | `… behaves like an app — full screen, no browser chrome.` |
| `The native iPadOS app is in developer preview. There is no App Store listing today. The PWA is the product.` | `The native iPadOS app is in developer preview and is not on the App Store. The PWA is what you install today.` |

The `INTEGRATION BOUNDARY` fine print (private version-checked Codex Desktop
IPC, fails closed, not a public API, no speech server) is **unchanged** — it was
already written in the right voice.

### Section 10 — install + footer

| Before | After |
| --- | --- |
| `Put it on the coffee table.` | `Install it in three steps.` |
| `… · DEVELOPER PREVIEW NATIVE APP SEPARATELY` | `… · NATIVE APP IS DEVELOPER PREVIEW ONLY` |
| footer `A CONTROL SURFACE FOR THE CODEX TASKS YOU ARE ALREADY RUNNING.` | `A PAD FOR THE CODEX TASKS YOU ARE ALREADY RUNNING.` |

The install strip already matched the new headline (`RUN COMMAND → SCAN QR WITH
IPAD → ADD TO HOME SCREEN`), so the headline now points at it instead of
selling a lifestyle. The old trailing spec line parsed badly.

---

## 2. Changes in `the-pad-landing-proposal.md`

The proposal prescribes the page's copy in quoted blocks, so those blocks were
resynced to match the mock: positioning sentence, hero headline + subhead,
argument block, lanes block, hold-to-speak block, anatomy headline, the three
signal-path lines, player block, themes line, and the spec-plate block. Also
updated: the Micro Deck description (twelve lanes), the typography example
headline, and `This section is where restraint reads as confidence.` → a plain
statement of what the headline should do.

Added one short **Copy voice** paragraph under §1 so the next person editing
this page knows the visual direction and the writing direction are deliberately
not the same register.

Left alone: the design-rationale prose in §1–§2 and §4–§6 (the Stream Deck /
Teenage Engineering argument, the "explicitly avoided" list, implementation
notes, open questions). That's internal reasoning addressed to the team, not
page copy, and rewriting it would erase the record of why the page looks like
this.

---

## 3. Left alone deliberately, in the mock

- **All instrument labels and legends.** `MODEL SE-1`, `9 LANES · PARAKEET ASR`,
  `GRAPHITE / MINT`, `UNIT 001 · FLIGHT`, `LN 1`–`LN 9`, `HOLD TO SPEAK`,
  `RPLY / STOP / AUTO / ACTV`, `BRIDGE / MIC / QUEUE 2`, `HOLD TO BIND`,
  `LIVE / IDLE / QUEUED`, nav links, `MAC LIVE`. These are the visual design
  speaking, not prose making claims, and the brief says the visual design stays.
- **The spec lines.** `PWA · PAIRS OVER LOCAL NETWORK · NO APP STORE REQUIRED`,
  `TRANSCRIPTION: ON-DEVICE · ROUTING: EXACT TASK ID · DELIVERY: EXACTLY ONCE`,
  `SCRUB · 0.5–2× SPEED · VOLUME ON THE ENCODER · DURABLE QUEUE`, and the whole
  `INTEGRATION BOUNDARY` block. Already plain and verifiable.
- **Lane 2's error snippet** (`I could not reach the exact Codex task. Open the…`).
  That's a sample of a real fail-closed error string, and it's good evidence for
  the claim — it stays.
- **`<title>`**, section anchors, `DESIGN MOCK — NOT A SHIPPING PAGE`, and the
  legend item 05 (transport), which was already a plain list.
- **`THE BIG BAR`** as the section 4 label — it names a physical thing rather
  than editorializing.
- **Hero H1 length.** The new H1's longest line (25 chars) is within one
  character of the old one (24), so its wrapping behavior in the narrow hero
  column is unchanged. I did not touch it further.

---

## 4. Layout notes for whoever owns styling next

Nothing here needs a fix from me — flagging so the textures/color pass isn't
surprised:

1. **Anatomy H2 went from two lines to one** (`Everything is labeled. / Nothing
   is hidden.` → `What the controls do.`). `.sec-head` is now shorter by one
   display line before the diagram. If that section wants more vertical mass,
   that's a spacing decision, not a copy one — I'd rather not pad the sentence
   back out to fill space.
2. **Argument H2** keeps its three-line / dim / accent structure. I deliberately
   sized the last line (`All nine on one screen.`, 23 chars) *shorter* than the
   old one (`They need a channel strip.`, 26 chars) so it can't overflow
   `.wrap` at the 84px clamp ceiling. Don't lengthen it past ~26 characters.
3. **Themes H2 is now noticeably shorter** (`Five themes, / same layout.`). Same
   note as #1 — shorter block, unchanged CSS.
4. Every other change is same-order-of-magnitude in length or slightly longer
   within body paragraphs that already wrap freely.

Verified after editing: HTML tag counts balanced, one `<style>` block, no
declarations touched.
