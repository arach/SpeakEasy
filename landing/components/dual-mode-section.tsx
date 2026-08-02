import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  Check,
  LockKeyhole,
  MessageSquareText,
  Mic2,
  Route,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const loop = [
  { label: "Speak", detail: "One explicit utterance", icon: Mic2 },
  { label: "Transcribe", detail: "Locally on your Mac", icon: AudioLines },
  { label: "Route", detail: "To the exact Codex task", icon: Route },
  { label: "Answer", detail: "Inside the real thread", icon: MessageSquareText },
  { label: "Hear", detail: "Through the native player", icon: Sparkles },
]

export default function DualModeSection() {
  return (
    <section id="dual-mode" className="relative border-y border-slate-200/60 bg-gradient-to-b from-white via-emerald-50/25 to-white px-4 py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(16,185,129,0.06),transparent_30%),radial-gradient(circle_at_82%_70%,rgba(59,130,246,0.05),transparent_30%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-5 rounded-xl border-emerald-200 bg-white/80 text-emerald-700">
            Two-way voice · available now
          </Badge>
          <h2 className="font-display text-4xl font-extralight leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Speak to the task you’re already in.
            <span className="block bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text font-light text-transparent">
              Hear its real answer come back.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-text text-lg font-light leading-relaxed text-slate-600">
            SpeakEasy now joins local speech recognition and controllable narration around one exact Codex Desktop conversation.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-xl shadow-emerald-950/5 backdrop-blur-xl">
          <div className="grid divide-y divide-slate-200/70 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            {loop.map((step, index) => (
              <div key={step.label} className="relative p-5 text-center sm:p-6">
                {index < loop.length - 1 && (
                  <ArrowRight className="absolute -right-2 top-8 z-10 hidden h-4 w-4 rounded-full bg-white text-slate-300 sm:block" />
                )}
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-blue-50 text-emerald-600 ring-1 ring-emerald-100">
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900">{step.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <article className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Mic2 className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Available now
                </span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-medium text-slate-900">Listen · ASR</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Press once to record and again to send. Vox transcribes locally before SpeakEasy routes the final text to the task you chose.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <AudioLines className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Available now
                </span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-medium text-slate-900">Speak · TTS</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The task’s response returns through the menu-bar player with autoplay, queueing, speed, volume, and a live transcript HUD.
              </p>
            </article>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <LockKeyhole className="h-4 w-4 text-emerald-600" />
                  Exact-task mapping
                </div>
                <p className="mt-1 text-xs text-slate-500">Nine persistent lanes. No focus guessing.</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-600">⌘⌥1…9</span>
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                ["1", "Website narrative", "Locked", true],
                ["2", "Native player release", "Ready", false],
                ["3", "Claude adapter", "Next", false],
              ].map(([number, title, state, active]) => (
                <div
                  key={String(number)}
                  className={`flex items-center gap-4 rounded-xl border p-3.5 ${
                    active ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200/70 bg-slate-50/60"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs ${active ? "bg-emerald-600 text-white" : "bg-white text-slate-500"}`}>
                    {number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">Exact Codex Desktop task</div>
                  </div>
                  <span className={`text-xs font-medium ${active ? "text-emerald-700" : "text-slate-400"}`}>{state}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Task ID is routing authority</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Every activation revalidates the lock</li>
              </ul>
              <Button asChild className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                <Link href="/codex/">
                  See the Codex mapping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
