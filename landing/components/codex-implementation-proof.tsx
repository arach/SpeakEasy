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
  MonitorUp,
  Route,
  Tablet,
} from "lucide-react"

const padModes = [
  {
    id: "console",
    label: "Console",
    eyebrow: "Recommended",
    title: "The whole conversation at a glance",
    detail: "Nine durable voice lanes sit beside the active Codex task. This capture is the real Pad holding lane 02 open for speech.",
    image: "/implementation/pad-console.webp",
    alt: "Implemented SpeakEasy Pad console recording speech for the Hudson Codex task in lane 2",
  },
  {
    id: "cluster",
    label: "Cluster",
    eyebrow: "Focus",
    title: "One task becomes the instrument",
    detail: "The active conversation moves to the center while all nine lanes remain reachable along the iPad’s lower edge.",
    image: "/implementation/pad-cluster.webp",
    alt: "Implemented SpeakEasy Pad cluster layout focused on the Hudson Codex task",
  },
  {
    id: "deck",
    label: "Flight Deck",
    eyebrow: "Tactile",
    title: "Nine lanes, nine physical-feeling strips",
    detail: "A mixer-like view turns long-running Codex tasks into a bank of tactile channels with speech and playback controls below.",
    image: "/implementation/pad-deck.webp",
    alt: "Implemented SpeakEasy Pad flight deck with nine tactile Codex lane strips",
  },
  {
    id: "checklist",
    label: "Checklist",
    eyebrow: "Auditable",
    title: "Dense enough for an operator",
    detail: "Assignments, task locks, link state, input, lease, and phase stay legible in one deliberately operational view.",
    image: "/implementation/pad-checklist.webp",
    alt: "Implemented SpeakEasy Pad checklist layout showing lane assignments and task state",
  },
  {
    id: "pfd",
    label: "Glass PFD",
    eyebrow: "Ambient",
    title: "A quiet field for a live conversation",
    detail: "The task, link health, narration, lanes, and push-to-talk control become a calm heads-up instrument.",
    image: "/implementation/pad-pfd.webp",
    alt: "Implemented SpeakEasy Pad glass PFD layout for a live Codex conversation",
  },
  {
    id: "micro",
    label: "Micro Deck",
    eyebrow: "Hardware",
    title: "A translucent desktop instrument",
    detail: "The same semantics take on a physical control-surface finish without changing the task lock or command channel.",
    image: "/implementation/pad-micro.webp",
    alt: "Implemented SpeakEasy Pad micro deck with translucent hardware controls",
  },
] as const

type PadModeId = (typeof padModes)[number]["id"]

const flow = [
  { icon: Route, step: "01", title: "Choose a lane", body: "Select the durable task assignment." },
  { icon: Mic2, step: "02", title: "Hold to speak", body: "The Mac records the deliberate turn." },
  { icon: LockKeyhole, step: "03", title: "Codex continues", body: "The exact task—not a new chat—receives it." },
  { icon: Headphones, step: "04", title: "Hear the answer", body: "TTS returns the real task response." },
] as const

const toneStyles = {
  emerald: {
    eyebrow: "text-emerald-700",
    activeTab: "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-emerald-900/5",
    dot: "bg-emerald-300",
    soft: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    glow: "from-emerald-300/20 via-cyan-300/10 to-transparent",
    flowIcon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  blue: {
    eyebrow: "text-blue-700",
    activeTab: "border-blue-300 bg-blue-50 text-blue-950 shadow-blue-900/5",
    dot: "bg-cyan-300",
    soft: "bg-blue-50 text-blue-800 ring-blue-100",
    glow: "from-blue-300/20 via-cyan-300/10 to-transparent",
    flowIcon: "bg-blue-50 text-blue-700 ring-blue-100",
  },
} as const

export default function CodexImplementationProof({ tone = "emerald" }: { tone?: keyof typeof toneStyles }) {
  const [activeModeId, setActiveModeId] = useState<PadModeId>("console")
  const activeMode = padModes.find((mode) => mode.id === activeModeId) ?? padModes[0]
  const palette = toneStyles[tone]

  return (
    <section id="actual-implementation" className="scroll-mt-44 border-b border-slate-200/70 bg-[#f6f7f5] px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[86rem]">
        <div className="mx-auto grid max-w-6xl items-end gap-8 lg:grid-cols-[1fr_0.72fr]">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${palette.eyebrow}`}>
              Actual implementation · iPad Pad build · 6ff1d58
            </div>
            <h2 className="mt-4 max-w-4xl font-display text-4xl font-extralight leading-[1.02] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              The iPad is the conversation surface.
            </h2>
          </div>
          <p className="max-w-xl text-sm font-light leading-6 text-slate-600 sm:text-base sm:leading-7">
            This is the implemented SpeakEasy Pad—not concept art. Pick a durable Codex lane, hold to talk, and hear the same task answer while the Mac quietly owns the microphone, task lock, routing, and narration.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-[2rem] border border-slate-800 bg-[#070b0c] shadow-[0_35px_100px_-35px_rgba(2,12,12,0.65)] sm:rounded-[2.5rem]">
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-br ${palette.glow} opacity-80 blur-3xl`} />

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${palette.dot} shadow-[0_0_16px_currentColor]`} />
              <div>
                <div className="text-xs font-semibold text-white">SpeakEasy Pad</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">real browser build · iPad landscape · interactive demo transport</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-slate-300">
              <Check className="h-3 w-3 text-emerald-300" />
              Source-rendered on July 29
            </span>
          </div>

          <div className="relative p-3 sm:p-5 lg:p-7">
            <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Implemented SpeakEasy Pad layouts">
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
                    className={`min-w-[8.25rem] rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none sm:min-w-[9.25rem] ${
                      isActive
                        ? `${palette.activeTab} shadow-lg`
                        : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.065]"
                    }`}
                  >
                    <span className={`block font-mono text-[8px] uppercase tracking-[0.18em] ${isActive ? "text-slate-500" : "text-slate-600"}`}>{mode.eyebrow}</span>
                    <span className="mt-1 block text-xs font-semibold">{mode.label}</span>
                  </button>
                )
              })}
            </div>

            <div id="pad-layout-panel" role="tabpanel" className="mt-1">
              <div className="grid items-end gap-5 px-1 py-5 sm:px-2 lg:grid-cols-[1fr_0.7fr] lg:px-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-300">Implemented layout · {activeMode.label}</div>
                  <h3 className="mt-2 font-display text-2xl font-light tracking-tight text-white sm:text-3xl">{activeMode.title}</h3>
                </div>
                <p className="max-w-2xl text-xs font-light leading-5 text-slate-400 sm:text-sm sm:leading-6">{activeMode.detail}</p>
              </div>

              <div className="relative overflow-hidden rounded-[1.25rem] border border-white/15 bg-black p-1 shadow-2xl shadow-black/60 sm:rounded-[1.8rem] sm:p-1.5">
                <div className="pointer-events-none absolute inset-x-[12%] top-0 z-10 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent" />
                <img
                  key={activeMode.image}
                  src={activeMode.image}
                  alt={activeMode.alt}
                  width={1366}
                  height={1024}
                  className="aspect-[4/3] h-auto w-full rounded-[1rem] object-cover sm:rounded-[1.45rem]"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600 sm:px-2">
                <span>1366 × 1024 implementation capture</span>
                <span>pad/src · TypeScript + CSS · Mac-authoritative transport</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-7 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {flow.map(({ icon: Icon, step, title, body }) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${palette.flowIcon}`}><Icon className="h-4 w-4" /></span>
                <span className="font-mono text-[9px] text-slate-300">{step}</span>
              </div>
              <h4 className="mt-4 text-sm font-semibold text-slate-900">{title}</h4>
              <p className="mt-1.5 text-xs font-light leading-5 text-slate-500">{body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-7 grid max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.05] lg:grid-cols-[0.72fr_1.28fr]">
          <div className="flex items-center justify-center border-b border-slate-200 bg-[#0a0b0b] p-7 lg:border-b-0 lg:border-r sm:p-9">
            <figure className="flex items-center gap-6 lg:block">
              <img
                src="/implementation/popover-redesign.png"
                alt="Newest preserved SpeakEasy Mac menu bar popover playing a Codex response"
                width={320}
                height={765}
                className="h-auto w-[132px] rounded-xl shadow-2xl shadow-black sm:w-[172px] lg:w-[200px]"
              />
              <figcaption className="max-w-[14rem] lg:mt-5">
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">Mac companion</div>
                <p className="mt-2 text-xs font-light leading-5 text-slate-400">Resident, exact-task aware, and intentionally supporting—not the hero.</p>
              </figcaption>
            </figure>
          </div>

          <div className="p-6 sm:p-9 lg:p-11">
            <div className={`text-xs font-semibold uppercase tracking-[0.2em] ${palette.eyebrow}`}>One system, two surfaces</div>
            <h3 className="mt-3 max-w-2xl font-display text-3xl font-light tracking-tight text-slate-900 sm:text-4xl">
              The Pad is visible. The Mac is authoritative.
            </h3>
            <p className="mt-4 max-w-2xl text-sm font-light leading-6 text-slate-600">
              The iPad chooses the lane and requests semantic actions. The Mac keeps the actual Codex task lock, captures audio, submits the transcript, narrates the response, and returns a revisioned snapshot. That split makes the Pad feel immediate without pretending Safari owns the conversation.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                [Tablet, "pad/src", "Six finished layouts"],
                [MonitorUp, "SpeakEasy.app", "Mic + task authority"],
                [Code2, "Wire protocol", "Versioned commands"],
              ].map(([ItemIcon, file, role]) => {
                const Icon = ItemIcon as typeof Tablet
                return (
                  <div key={String(file)} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-700"><Icon className="h-3 w-3 text-slate-400" /> {String(file)}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{String(role)}</div>
                  </div>
                )
              })}
            </div>

            <div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${palette.soft}`}>Build truth</span>
                <p className="max-w-xl text-xs leading-5 text-slate-600">
                  The Pad capture runs the real UI against its local demo transport. The preserved Pad/redesign branch is newer than the public master line; it is implementation evidence, not a claim that every branch has already merged.
                </p>
              </div>
              <Link href="/docs/listening-mode/" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700 transition hover:text-slate-950">
                Implementation guide <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
