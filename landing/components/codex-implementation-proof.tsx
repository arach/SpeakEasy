"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Check,
  Code2,
  Headphones,
  LockKeyhole,
  Mic2,
  Route,
} from "lucide-react"

const states = [
  {
    id: "map",
    short: "1",
    label: "Map lane",
    title: "Choose the real Codex task",
    detail: "The native task browser maps lane 6 to an exact task ID. The current lock stays put until the new assignment is validated.",
    image: "/implementation/lane-browser.png",
    alt: "Actual SpeakEasy task browser mapping voice lane 6 to a recent Codex task",
    imageClass: "max-h-[270px] w-auto",
    icon: Route,
  },
  {
    id: "listen",
    short: "2",
    label: "Listen",
    title: "Record one deliberate utterance",
    detail: "The native HUD shows lane 2, the locked task, the selected microphone, and the live local input meter while ⌃⌥Space is active.",
    image: "/implementation/hud-listening.png",
    alt: "Actual SpeakEasy native HUD in the listening state for lane 2",
    imageClass: "w-full max-w-[560px]",
    icon: Mic2,
  },
  {
    id: "route",
    short: "3",
    label: "Send",
    title: "Submit to that task—not a new chat",
    detail: "The same HUD exposes the submitting state and keeps both the lane and exact task identity visible while Codex owns the turn.",
    image: "/implementation/hud-waiting.png",
    alt: "Actual SpeakEasy native HUD submitting a transcript to the locked Codex task",
    imageClass: "w-full max-w-[560px]",
    icon: LockKeyhole,
  },
  {
    id: "speak",
    short: "4",
    label: "Hear",
    title: "Play the task’s real response",
    detail: "The speaking HUD follows narration progress and keeps Back to Codex attached to the task that produced the answer.",
    image: "/implementation/hud-speaking.png",
    alt: "Actual SpeakEasy native HUD speaking the response with a Back to Codex control",
    imageClass: "w-full max-w-[560px]",
    icon: Headphones,
  },
] as const

type StateId = (typeof states)[number]["id"]

const toneStyles = {
  emerald: {
    eyebrow: "text-emerald-700",
    activeButton: "border-emerald-500 bg-emerald-500 text-slate-950 shadow-emerald-500/20",
    dot: "bg-emerald-400",
    soft: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    glow: "from-emerald-400/25 via-cyan-400/10 to-transparent",
  },
  blue: {
    eyebrow: "text-blue-700",
    activeButton: "border-blue-400 bg-blue-400 text-slate-950 shadow-blue-500/20",
    dot: "bg-blue-400",
    soft: "bg-blue-50 text-blue-800 ring-blue-100",
    glow: "from-blue-400/25 via-violet-400/10 to-transparent",
  },
} as const

export default function CodexImplementationProof({ tone = "emerald" }: { tone?: keyof typeof toneStyles }) {
  const [activeId, setActiveId] = useState<StateId>("listen")
  const active = states.find((state) => state.id === activeId) ?? states[1]
  const palette = toneStyles[tone]

  return (
    <section id="actual-implementation" className="scroll-mt-44 border-b border-slate-200/70 bg-white px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.72fr]">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${palette.eyebrow}`}>
              Actual implementation · current SwiftUI build
            </div>
            <h2 className="mt-4 max-w-3xl font-display text-4xl font-extralight leading-[1.02] tracking-tight text-slate-900 sm:text-5xl">
              Not a diagram. These are the native surfaces running now.
            </h2>
          </div>
          <p className="max-w-xl text-sm font-light leading-6 text-slate-600 sm:text-base sm:leading-7">
            Every frame below was rendered directly from the current macOS app source—player, task browser, listening HUD, submission state, and spoken return. The browser only lets you inspect those real states in sequence.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-[2rem] border border-slate-800 bg-[#070909] shadow-2xl shadow-slate-950/20">
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-br ${palette.glow} opacity-80 blur-3xl`} />

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${palette.dot} shadow-[0_0_16px_currentColor]`} />
              <div>
                <div className="text-xs font-semibold text-white">SpeakEasy.app</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">debug snapshot harness · native SwiftUI</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-slate-300">
              <Check className="h-3 w-3 text-emerald-400" />
              Source-rendered, not reconstructed
            </span>
          </div>

          <div className="relative grid gap-0 lg:grid-cols-[0.66fr_1.34fr]">
            <div className="flex items-start justify-center border-b border-white/10 bg-black/20 p-6 lg:border-b-0 lg:border-r lg:p-8">
              <figure className="w-full max-w-[320px]">
                <div className="mb-3 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                  <span>Permanent menu-bar player</span>
                  <span>320 × 768</span>
                </div>
                <img
                  src="/implementation/native-player.png"
                  alt="Actual SpeakEasy native menu-bar player showing the exact-task conversation controls and nine voice lanes"
                  width={320}
                  height={768}
                  className="h-auto w-full rounded-2xl shadow-2xl shadow-black"
                />
                <figcaption className="mt-4 text-xs leading-5 text-slate-500">
                  The current popover: exact-task lock, nine lanes, microphone, playback queue, transport, speed, and volume in one resident surface.
                </figcaption>
              </figure>
            </div>

            <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-9">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Actual implementation states">
                {states.map((state) => {
                  const Icon = state.icon
                  const isActive = active.id === state.id
                  return (
                    <button
                      key={state.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="implementation-state-panel"
                      onClick={() => setActiveId(state.id)}
                      className={`flex min-h-16 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none ${
                        isActive
                          ? `${palette.activeButton} shadow-lg`
                          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>
                        <span className={`block font-mono text-[9px] ${isActive ? "text-slate-800/60" : "text-slate-600"}`}>0{state.short}</span>
                        <span className="block text-xs font-semibold">{state.label}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div id="implementation-state-panel" role="tabpanel" className="mt-7 flex flex-1 flex-col">
                <div>
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Native state · {active.label}</div>
                  <h3 className="mt-3 font-display text-3xl font-light tracking-tight text-white sm:text-4xl">{active.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm font-light leading-6 text-slate-400">{active.detail}</p>
                </div>

                <div className="mt-7 flex min-h-[310px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.055),transparent_62%)] p-5 sm:p-8">
                  <img
                    key={active.image}
                    src={active.image}
                    alt={active.alt}
                    className={`h-auto object-contain ${active.imageClass}`}
                  />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ["PlayerPopoverView.swift", "Player + conversation"],
                    ["ListeningPopoverSection.swift", "Task lock + lanes"],
                    ["HUDView.swift", "Listen → speak states"],
                  ].map(([file, role]) => (
                    <div key={file} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300"><Code2 className="h-3 w-3 text-slate-500" /> {file}</div>
                      <div className="mt-1 text-[10px] text-slate-600">{role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${palette.soft}`}>Implementation evidence</span>
            <p className="max-w-2xl text-xs leading-5 text-slate-600">
              The snapshot fixture uses exact task IDs, real lane assignment code, and the production SwiftUI views. It does not exercise a public Codex API; listening remains a source-built technical preview.
            </p>
          </div>
          <Link href="/docs/listening-mode/" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700 transition hover:text-slate-950">
            Read the implementation guide <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
