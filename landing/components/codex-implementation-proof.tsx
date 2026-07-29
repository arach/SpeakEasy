"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Headphones,
  LockKeyhole,
  Mic2,
  Route,
} from "lucide-react"

const padModes = [
  {
    id: "console",
    label: "Console",
    detail: "Nine voice lanes beside the live Codex task—lane 02 open for speech.",
    image: "/implementation/pad-console.webp",
    alt: "Implemented SpeakEasy Pad console recording speech for the Hudson Codex task in lane 2",
  },
  {
    id: "cluster",
    label: "Cluster",
    detail: "The active task is centered while all nine lanes stay on the lower edge.",
    image: "/implementation/pad-cluster.webp",
    alt: "Implemented SpeakEasy Pad cluster layout focused on the Hudson Codex task",
  },
  {
    id: "deck",
    label: "Flight Deck",
    detail: "Mixer-like strips turn long-running Codex tasks into tactile channels.",
    image: "/implementation/pad-deck.webp",
    alt: "Implemented SpeakEasy Pad flight deck with nine tactile Codex lane strips",
  },
  {
    id: "checklist",
    label: "Checklist",
    detail: "Assignments, locks, lease, and phase stay visible in one operator view.",
    image: "/implementation/pad-checklist.webp",
    alt: "Implemented SpeakEasy Pad checklist layout showing lane assignments and task state",
  },
  {
    id: "pfd",
    label: "Glass PFD",
    detail: "A quiet heads-up field for task, link, narration, and push-to-talk.",
    image: "/implementation/pad-pfd.webp",
    alt: "Implemented SpeakEasy Pad glass PFD layout for a live Codex conversation",
  },
  {
    id: "micro",
    label: "Micro Deck",
    detail: "The same conversation semantics in a hardware-like control surface.",
    image: "/implementation/pad-micro.webp",
    alt: "Implemented SpeakEasy Pad micro deck with translucent hardware controls",
  },
] as const

type PadModeId = (typeof padModes)[number]["id"]

const flow = [
  { icon: Route, step: "01", title: "Choose a lane", body: "Select the durable task assignment." },
  { icon: Mic2, step: "02", title: "Hold to speak", body: "The Mac records one deliberate turn." },
  { icon: LockKeyhole, step: "03", title: "Codex continues", body: "The exact task—not a new chat—receives it." },
  { icon: Headphones, step: "04", title: "Hear the answer", body: "TTS returns the task’s real response." },
] as const

const toneStyles = {
  emerald: {
    eyebrow: "text-emerald-700",
    activeTab: "border-emerald-300/50 bg-white/10 text-white",
    focusRing: "focus-visible:ring-emerald-300/60",
    glow: "bg-emerald-400/10",
  },
  blue: {
    eyebrow: "text-blue-700",
    activeTab: "border-cyan-300/50 bg-white/10 text-white",
    focusRing: "focus-visible:ring-cyan-300/60",
    glow: "bg-cyan-400/10",
  },
} as const

export default function CodexImplementationProof({ tone = "emerald" }: { tone?: keyof typeof toneStyles }) {
  const [activeModeId, setActiveModeId] = useState<PadModeId>("console")
  const activeMode = padModes.find((mode) => mode.id === activeModeId) ?? padModes[0]
  const palette = toneStyles[tone]

  return (
    <section id="actual-implementation" className="scroll-mt-44 border-b border-slate-200/70 bg-[#f6f7f5] px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-5xl text-center">
          <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${palette.eyebrow}`}>
            Actual implementation
          </div>
          <h2 className="mt-4 font-display text-4xl font-extralight leading-[1.02] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            The iPad is the conversation surface.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm font-light leading-6 text-slate-600 sm:text-base sm:leading-7">
            Real SpeakEasy Pad. Pick a Codex lane, hold to talk, and hear the same task answer. The Mac owns the microphone, task lock, and narration.
          </p>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-[1.5rem] border border-slate-900/80 bg-[#050708] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)] sm:mt-12 sm:rounded-[2rem]">
          <div
            className={`pointer-events-none absolute left-1/2 top-[42%] h-[32rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full ${palette.glow} blur-3xl`}
            aria-hidden
          />

          <div className="relative px-1.5 pb-4 pt-1.5 sm:px-4 sm:pb-6 sm:pt-4 lg:px-6 lg:pb-7">
            <div className="relative overflow-hidden rounded-[1.1rem] ring-1 ring-white/10 sm:rounded-2xl">
              <img
                key={activeMode.image}
                src={activeMode.image}
                alt={activeMode.alt}
                width={1366}
                height={1024}
                className="h-auto w-full object-contain"
              />
            </div>

            <div
              className="mt-4 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Implemented SpeakEasy Pad layouts"
            >
              {padModes.map((mode) => {
                const isActive = mode.id === activeMode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="pad-layout-panel"
                    onClick={() => setActiveModeId(mode.id)}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none ${palette.focusRing} ${
                      isActive
                        ? palette.activeTab
                        : "border-transparent bg-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"
                    }`}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>

            <div id="pad-layout-panel" role="tabpanel" className="mt-3">
              <p className="text-sm font-light leading-6 text-slate-400 sm:text-center sm:text-[0.9375rem]">
                {activeMode.detail}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-0 border-t border-slate-200 pt-8 sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
          {flow.map(({ icon: Icon, step, title, body }) => (
            <div key={step} className="flex gap-3 px-1 py-3 sm:flex-col sm:px-5 sm:py-0">
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">{step}</span>
                <Icon className={`h-3.5 w-3.5 ${palette.eyebrow}`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
                <p className="mt-1 text-xs font-light leading-5 text-slate-500">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-900/[0.03] sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <img
            src="/implementation/popover-redesign.png"
            alt="SpeakEasy Mac menu bar popover playing a Codex response"
            width={320}
            height={765}
            className="h-auto w-[72px] rounded-md shadow-md sm:w-[88px]"
          />
          <div className="min-w-0 flex-1">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.eyebrow}`}>
              Mac companion
            </div>
            <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
              The Pad is visible. The Mac is authoritative.
            </p>
            <p className="mt-1 max-w-2xl text-xs font-light leading-5 text-slate-500">
              iPad chooses the lane and requests actions. Mac holds task lock, mic, and narration.
            </p>
          </div>
          <Link href="/docs/listening-mode/" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700 transition hover:text-slate-950">
            Implementation guide <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
