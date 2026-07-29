"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import CodexImplementationProof from "@/components/codex-implementation-proof"
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  Headphones,
  LockKeyhole,
  Mic,
  Pause,
  Play,
  Route,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react"

const variations = [
  {
    id: "lanes",
    number: "01",
    name: "Nine Lanes",
    premise:
      "The keyboard grid is the product: voice only becomes useful when a numbered lane holds a real Codex task identity.",
  },
  {
    id: "seal",
    number: "02",
    name: "Thread with a Seal",
    premise:
      "Every listen and speak turn wears the same sealed task ID so Codex continues the real conversation—never a shadow thread.",
  },
  {
    id: "instrument",
    number: "03",
    name: "Menu-Bar Instrument",
    premise:
      "Half-duplex controls on the Mac: a deliberate microphone for one utterance, a native player for the answer, both locked to the same task.",
  },
] as const

type VariationId = (typeof variations)[number]["id"]

function StudyChrome() {
  const [active, setActive] = useState<VariationId>("lanes")

  useEffect(() => {
    const sections = variations
      .map((v) => document.getElementById(v.id))
      .filter(Boolean) as HTMLElement[]

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) {
          setActive(visible.target.id as VariationId)
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.35, 0.55] }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/codex/"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Codex
            </Link>
            <div className="hidden h-4 w-px bg-slate-200 sm:block" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Visual study · Grok
              </p>
              <p className="truncate text-sm font-medium text-slate-900">
                SpeakEasy × Codex · three directions
              </p>
            </div>
          </div>
          <p className="max-w-sm text-right text-[11px] leading-4 text-slate-500">
            Independent concept work. Not the production Codex page.
          </p>
        </div>

        <nav aria-label="Concept variations" className="flex gap-2 overflow-x-auto pb-0.5">
          {variations.map((v) => {
            const isActive = active === v.id
            return (
              <a
                key={v.id}
                href={`#${v.id}`}
                onClick={() => setActive(v.id)}
                className={`group flex min-w-[9.5rem] flex-1 items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-semibold tracking-wider ${
                    isActive ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {v.number}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-4">{v.name}</span>
                  <span
                    className={`mt-0.5 line-clamp-2 block text-[10px] leading-3.5 ${
                      isActive ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {v.premise}
                  </span>
                </span>
              </a>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

function ReadinessStrip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-[11px] ${className}`}
      role="list"
      aria-label="Product readiness"
    >
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-100" role="listitem">
        Player 0.2.17 · available now
      </span>
      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-amber-100" role="listitem">
        Exact-task listen · technical preview
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200" role="listitem">
        Source build for listening
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Variation 01 — Nine Lanes                                                  */
/* -------------------------------------------------------------------------- */

function WaveIntoLane() {
  const bars = [18, 34, 22, 48, 28, 56, 40, 62, 36, 50, 24, 44, 30, 52, 20]
  return (
    <div className="relative flex items-end justify-center gap-[3px] h-16" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-emerald-500 to-emerald-300 motion-safe:animate-pulse"
          style={{
            height: `${h}%`,
            animationDelay: `${i * 70}ms`,
            opacity: 0.55 + (i % 5) * 0.09,
          }}
        />
      ))}
    </div>
  )
}

function VariationLanes() {
  const lanes = [
    { n: 1, title: "Website narrative", state: "Locked", active: true, id: "019f…a4c1" },
    { n: 2, title: "Native player polish", state: "Ready", active: false, id: "019f…b812" },
    { n: 3, title: "Plugin packaging", state: "Idle", active: false, id: "—" },
    { n: 4, title: "", state: "Empty", active: false, id: "—" },
    { n: 5, title: "Release notes", state: "Ready", active: false, id: "019e…44f0" },
    { n: 6, title: "", state: "Empty", active: false, id: "—" },
    { n: 7, title: "", state: "Empty", active: false, id: "—" },
    { n: 8, title: "", state: "Empty", active: false, id: "—" },
    { n: 9, title: "Claude hooks (one-way)", state: "Notify", active: false, id: "hooks" },
  ]

  return (
    <section
      id="lanes"
      aria-labelledby="lanes-title"
      className="scroll-mt-36 border-b border-slate-200/70 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_38%,#ecfdf5_100%)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-emerald-700">
              VARIATION 01
            </p>
            <h2 id="lanes-title" className="mt-2 font-display text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl">
              Nine Lanes
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {variations[0].premise}
            </p>
          </div>
          <ReadinessStrip />
        </div>

        {/* Hero */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Addressable voice
            </p>
            <h3 className="mt-4 font-display text-4xl font-extralight leading-[1.02] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Speak to a{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text font-light text-transparent">
                numbered door
              </span>
              , not a focused window.
            </h3>
            <p className="mt-6 max-w-xl text-base font-light leading-7 text-slate-600 sm:text-lg">
              Nine persistent lanes—<span className="font-medium text-slate-800">⌘⌥1</span> through{" "}
              <span className="font-medium text-slate-800">⌘⌥9</span>—hold exact Codex task
              identities. Your utterance never rides focus, title, or recency.
            </p>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-slate-800">
              Speak to Codex. Hear it answer.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Begin / end utterance
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">⌃⌥Space</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Active lane
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-emerald-900">⌘⌥1 · locked</p>
              </div>
            </div>
          </div>

          {/* Lane grid illustration */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-100/60 via-transparent to-blue-100/40 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voice lanes</p>
                  <p className="mt-0.5 text-xs text-slate-500">Task ID is the authority</p>
                </div>
                <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-[10px] text-white">
                  ⌘⌥1…9
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                    <Mic className="h-3.5 w-3.5" />
                    Listening on lane 1
                  </div>
                  <span className="text-[10px] text-slate-500">Local transcription</span>
                </div>
                <div className="mt-3">
                  <WaveIntoLane />
                </div>
                <p className="mt-3 text-center text-sm italic text-slate-700">
                  “Make the readiness table unmistakable.”
                </p>
              </div>

              <div
                className="mt-4 grid grid-cols-3 gap-2"
                role="list"
                aria-label="Nine voice lanes"
              >
                {lanes.map((lane) => (
                  <div
                    key={lane.n}
                    role="listitem"
                    className={`rounded-xl border p-2.5 transition ${
                      lane.active
                        ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-900/5 ring-2 ring-emerald-200"
                        : lane.title
                          ? "border-slate-200 bg-slate-50/80"
                          : "border-dashed border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-semibold ${
                          lane.active
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-500 ring-1 ring-slate-200"
                        }`}
                      >
                        {lane.n}
                      </span>
                      <span className="font-mono text-[9px] text-slate-400">⌘⌥{lane.n}</span>
                    </div>
                    <p
                      className={`mt-2 truncate text-[11px] font-medium ${
                        lane.title ? "text-slate-800" : "text-slate-300"
                      }`}
                    >
                      {lane.title || "Empty lane"}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">
                      {lane.id}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] text-slate-200">
                <Route className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>
                  Waveform → lane 1 → exact task <span className="font-mono text-emerald-300">019f…a4c1</span>
                  . Fail-closed if the lock is gone.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Supporting story row */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Listen / ASR",
              body: "⌃⌥Space starts and ends one deliberate utterance. Transcription stays local on the Mac.",
            },
            {
              title: "Exact task",
              body: "The lane’s task identity—not folder, title, or window focus—receives the transcript.",
            },
            {
              title: "Speak / TTS",
              body: "Codex continues the real task. Its response returns through SpeakEasy’s menu-bar player.",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm"
            >
              <h4 className="text-sm font-semibold text-slate-900">{card.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Variation 02 — Thread with a Seal                                          */
/* -------------------------------------------------------------------------- */

function IdentityChip({
  label,
  tone = "neutral",
}: {
  label: string
  tone?: "neutral" | "listen" | "speak" | "seal"
}) {
  const tones = {
    neutral: "bg-white text-slate-600 ring-slate-200",
    listen: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    speak: "bg-blue-50 text-blue-800 ring-blue-200",
    seal: "bg-slate-900 text-emerald-300 ring-slate-800",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium ring-1 ${tones[tone]}`}
    >
      <LockKeyhole className="h-3 w-3" />
      {label}
    </span>
  )
}

function VariationSeal() {
  const turns = [
    {
      side: "you" as const,
      mode: "Listen",
      text: "Tighten the distinction between the stable player and the listening preview.",
    },
    {
      side: "codex" as const,
      mode: "Real task",
      text: "Stable 0.2.17 ships TTS and the menu-bar player. Exact-task listening is a technical preview on master—source build only.",
    },
    {
      side: "you" as const,
      mode: "Listen",
      text: "Keep the private Desktop bridge out of the public API story.",
    },
    {
      side: "codex" as const,
      mode: "Real task",
      text: "Agreed. Route through the version-checked IPC seam; never present it as a supported public Codex API.",
    },
  ]

  return (
    <section
      id="seal"
      aria-labelledby="seal-title"
      className="scroll-mt-36 border-b border-slate-200/70 bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-blue-700">
              VARIATION 02
            </p>
            <h2 id="seal-title" className="mt-2 font-display text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl">
              Thread with a Seal
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {variations[1].premise}
            </p>
          </div>
          <ReadinessStrip />
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-40">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Identity travels with every turn
            </p>
            <h3 className="mt-4 font-display text-4xl font-extralight leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
              Codex owns the conversation.
              <span className="mt-2 block font-light text-slate-500">
                SpeakEasy only carries the voice.
              </span>
            </h3>
            <p className="mt-6 text-base font-light leading-7 text-slate-600">
              Routing is explicit, inspectable, and fail-closed. The sealed task ID is attached to
              the listen leg and the speak leg. There is no shadow conversation, no focus
              guessing, no ambient listening.
            </p>

            <ol className="mt-8 space-y-3">
              {[
                ["Local transcript", "One deliberate utterance → text on device"],
                ["Exact route", "Transcript enters the sealed Codex task once"],
                ["Real reply", "Codex continues its own thread"],
                ["Native return", "Player, queue, speed, volume, HUD, back-link"],
              ].map(([title, body], i) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-sm font-medium text-slate-800">
              Speak to Codex. Hear it answer.
            </p>
          </div>

          {/* Conversation spine */}
          <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
            {/* Persistent seal bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Sealed task identity
                </p>
                <p className="mt-1 truncate text-sm font-medium">
                  Explain SpeakEasy’s new product story
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                  lane ⌘⌥1 · id 019f…a4c1 · ~/dev/SpeakEasy
                </p>
              </div>
              <IdentityChip label="ID stays attached" tone="seal" />
            </div>

            <div className="relative mt-6 space-y-4">
              {/* Vertical spine */}
              <div
                className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-gradient-to-b from-emerald-300 via-slate-200 to-blue-300 sm:left-5"
                aria-hidden="true"
              />

              {turns.map((turn, index) => {
                const isYou = turn.side === "you"
                return (
                  <article
                    key={index}
                    className={`relative pl-10 sm:pl-12 ${isYou ? "" : ""}`}
                  >
                    <span
                      className={`absolute left-2 top-4 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white sm:left-2.5 ${
                        isYou ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                      aria-hidden="true"
                    >
                      {isYou ? (
                        <Mic className="h-2.5 w-2.5 text-white" />
                      ) : (
                        <AudioLines className="h-2.5 w-2.5 text-white" />
                      )}
                    </span>

                    <div
                      className={`rounded-2xl border p-4 ${
                        isYou
                          ? "border-emerald-200/80 bg-emerald-50/50"
                          : "border-blue-200/80 bg-blue-50/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider ${
                            isYou ? "text-emerald-700" : "text-blue-700"
                          }`}
                        >
                          {isYou ? "You · SpeakEasy listen" : "Codex · real task"}
                        </span>
                        <IdentityChip
                          label="019f…a4c1"
                          tone={isYou ? "listen" : "speak"}
                        />
                        <span className="text-[10px] text-slate-400">{turn.mode}</span>
                      </div>
                      <p className="mt-2.5 text-sm leading-6 text-slate-800">{turn.text}</p>
                      {!isYou && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-blue-100 pt-3 text-[11px] text-slate-500">
                          <Headphones className="h-3.5 w-3.5 text-blue-600" />
                          Spoken through native player · queue · HUD · open originating task
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-xs font-semibold text-slate-900">What SpeakEasy does</p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-600">
                  <li className="flex gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                    Capture, transcribe locally, route, narrate
                  </li>
                  <li className="flex gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                    Keep the seal visible on every turn
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-xs font-semibold text-slate-900">What SpeakEasy never does</p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-600">
                  <li>Create a shadow conversation</li>
                  <li>Guess from window focus or recency</li>
                  <li>Listen ambiently or by wake word</li>
                </ul>
              </div>
            </div>

            {/* Bridge note */}
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 text-[11px] leading-5 text-slate-600">
              <span className="font-semibold text-slate-800">Codex first, Claude next.</span>{" "}
              Claude hooks already provide one-way spoken notifications. The same two-way
              contract—listen → exact conversation → spoken response—is intended for Claude after
              the Codex path is hardened. Not available as two-way today.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Variation 03 — Menu-Bar Instrument                                         */
/* -------------------------------------------------------------------------- */

function VariationInstrument() {
  return (
    <section
      id="instrument"
      aria-labelledby="instrument-title"
      className="scroll-mt-36 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-white to-blue-50/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-600">
              VARIATION 03
            </p>
            <h2
              id="instrument-title"
              className="mt-2 font-display text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl"
            >
              Menu-Bar Instrument
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {variations[2].premise}
            </p>
          </div>
          <ReadinessStrip />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Half-duplex by design
          </p>
          <h3 className="mt-4 font-display text-4xl font-extralight leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            One deliberate press to speak.
            <span className="mt-2 block bg-gradient-to-r from-slate-700 via-emerald-700 to-blue-700 bg-clip-text font-light text-transparent">
              One native surface to hear.
            </span>
          </h3>
          <p className="mx-auto mt-6 max-w-2xl text-base font-light leading-7 text-slate-600">
            SpeakEasy is not a chat chrome and not a dashboard. It is a Mac instrument that pairs
            a microphone control with the permanent menu-bar player—queue, playback, speed, volume,
            HUD, and a path back to the originating Codex task.
          </p>
        </div>

        {/* Instrument stage */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div
            className="pointer-events-none absolute inset-x-8 -top-6 h-32 rounded-full bg-emerald-200/30 blur-3xl motion-reduce:hidden"
            aria-hidden="true"
          />

          {/* Menu bar mock */}
          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-2.5 sm:px-5">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">SpeakEasy</span>
                <span className="hidden sm:inline">· menu bar</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Lane 1 locked
                </span>
                <span className="font-mono text-slate-400">0.2.17 player</span>
              </div>
            </div>

            <div className="grid lg:grid-cols-2">
              {/* Mic side */}
              <div className="border-b border-slate-100 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Listen
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Deliberate utterance</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                    Technical preview
                  </span>
                </div>

                <div className="mt-8 flex flex-col items-center">
                  <button
                    type="button"
                    className="group relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-xl shadow-emerald-900/25 outline-none ring-4 ring-emerald-100 transition hover:scale-[1.02] focus-visible:ring-emerald-300 motion-reduce:transition-none"
                    aria-label="Hold Control-Option-Space to begin or end one utterance"
                  >
                    <span
                      className="absolute inset-0 rounded-full bg-emerald-400/30 motion-safe:animate-ping motion-reduce:hidden"
                      style={{ animationDuration: "2.4s" }}
                      aria-hidden="true"
                    />
                    <Mic className="relative h-9 w-9" />
                  </button>
                  <p className="mt-5 font-mono text-sm font-semibold text-slate-900">⌃⌥Space</p>
                  <p className="mt-1 max-w-[16rem] text-center text-xs leading-5 text-slate-500">
                    Press to begin. Press again to end. One utterance for the active lane—not
                    ambient capture.
                  </p>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <LockKeyhole className="h-3.5 w-3.5 text-emerald-600" />
                    Active lock · ⌘⌥1
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    Explain SpeakEasy’s new product story
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    exact id 019f…a4c1 · revalidated every activation
                  </p>
                  <p className="mt-3 text-[11px] leading-5 text-slate-500">
                    Local transcription. Fail-closed if the Codex Desktop task is gone. Never
                    routes by window focus.
                  </p>
                </div>
              </div>

              {/* Player side */}
              <div className="bg-gradient-to-b from-white to-slate-50/80 p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Speak
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Native menu-bar player</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
                    Available now
                  </span>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        Codex response · lane 1
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        Stable 0.2.17 ships the player. Exact-task listening remains a source-built
                        technical preview on master.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Open task
                    </button>
                  </div>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-400">
                      <span>0:18</span>
                      <span>0:43</span>
                    </div>
                  </div>

                  {/* Transport */}
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400">
                      <SkipBack className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
                      <Pause className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400">
                      <SkipForward className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Speed", "1.0×"],
                      ["Volume", "70%"],
                      ["Queue", "2 ahead"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HUD strip */}
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Live HUD
                    </p>
                    <Volume2 className="h-3.5 w-3.5 text-blue-300" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Playing the task’s real response—not a parallel agent monologue. System
                    narration works without a cloud voice account; cloud voices remain an explicit
                    choice.
                  </p>
                </div>
              </div>
            </div>

            {/* Loop footer */}
            <div className="flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
                  <Mic className="h-3 w-3 text-emerald-600" />
                  Listen
                </span>
                <ArrowRight className="hidden h-3.5 w-3.5 text-slate-300 sm:block" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
                  <LockKeyhole className="h-3 w-3 text-slate-700" />
                  Exact task
                </span>
                <ArrowRight className="hidden h-3.5 w-3.5 text-slate-300 sm:block" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
                  <Play className="h-3 w-3 text-blue-600" />
                  Speak
                </span>
              </div>
              <p className="text-xs font-medium text-slate-800 sm:text-right">
                Speak to Codex. Hear it answer.
              </p>
            </div>
          </div>
        </div>

        {/* Honest boundaries */}
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              title: "Stable now",
              body: "Signed SpeakEasy 0.2.17 player and TTS. System narration needs no cloud account.",
            },
            {
              title: "Preview listen",
              body: "Exact-task Codex listening is opt-in on master, source-built, via a private version-checked Desktop IPC seam—not a public API.",
            },
            {
              title: "Plugin path",
              body: "Codex plugin is packaged; public directory listing is still in progress. Two-way Claude is next, not today.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
            >
              <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Page shell                                                                 */
/* -------------------------------------------------------------------------- */

export default function GrokConceptStudy() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <StudyChrome />

      <div className="border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Grok · independent visual concepts
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extralight leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
            Three ways to show the Codex loop
          </h1>
          <p className="mt-5 max-w-2xl text-base font-light leading-7 text-slate-600 sm:text-lg">
            Same product truth—local listen, exact-task route, real Codex conversation, native
            speak—rendered as three fully distinct storytelling directions for review.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {variations.map((v) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="font-mono text-slate-400">{v.number}</span>{" "}
                {v.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <CodexImplementationProof tone="blue" />

      <VariationLanes />
      <VariationSeal />
      <VariationInstrument />

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-900">Grok concept study complete</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Route <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">/codex/concepts/grok/</code>
              . Independent of the production Codex page and of Kimi’s concepts.
            </p>
          </div>
          <Link
            href="/codex/"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Return to Codex
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </footer>
    </main>
  )
}
