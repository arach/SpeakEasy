import { ArrowRight, AudioLines, Check, Headphones, LockKeyhole, Mic } from "lucide-react"
import ReadinessStrip from "./readiness-strip"

function Waveform({ tone = "emerald" }: { tone?: "emerald" | "blue" }) {
  const bars = [16, 32, 48, 26, 44, 34, 58, 40, 52, 28, 46, 36, 50, 22, 42]
  const from = tone === "emerald" ? "from-emerald-600" : "from-blue-600"
  const to = tone === "emerald" ? "to-emerald-300" : "to-blue-300"
  return (
    <div className="flex items-end justify-center gap-[3px] h-12" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full bg-gradient-to-t ${from} ${to} motion-safe:animate-pulse`}
          style={{
            height: `${h}%`,
            animationDelay: `${i * 65}ms`,
            opacity: 0.45 + (i % 5) * 0.09,
          }}
        />
      ))}
    </div>
  )
}

export default function VariationHinge() {
  return (
    <section
      id="hinge"
      aria-labelledby="hinge-title"
      className="scroll-mt-40 border-b border-slate-200/70 bg-gradient-to-br from-emerald-50/30 via-white to-blue-50/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-blue-700">
              VARIATION 02
            </p>
            <h2
              id="hinge-title"
              className="mt-2 font-display text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl"
            >
              Hinged Modes
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Listen and Speak are two halves of one card, hinged on the persistent task identity
              that Codex owns and continues.
            </p>
          </div>
          <ReadinessStrip />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            One task is the hinge
          </p>
          <h3 className="mt-4 font-display text-4xl font-extralight leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Two modes.{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text font-light text-transparent">
              One sealed conversation.
            </span>
          </h3>
          <p className="mx-auto mt-6 max-w-2xl text-base font-light leading-7 text-slate-600 sm:text-lg">
            The left half listens. The right half speaks. Between them is the exact Codex task that
            makes them the same conversation—not two disconnected tools.
          </p>
        </div>

        {/* Hinged card */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="pointer-events-none absolute inset-x-10 -top-8 h-40 rounded-full bg-emerald-200/25 blur-3xl motion-reduce:hidden" aria-hidden="true" />

          <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10">
            {/* Central seal */}
            <div className="relative z-10 mx-auto mb-6 mt-6 flex max-w-xs flex-col items-center rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3 text-center text-white shadow-xl lg:absolute lg:left-1/2 lg:top-1/2 lg:mb-0 lg:-translate-x-1/2 lg:-translate-y-1/2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <LockKeyhole className="h-3.5 w-3.5" />
                Sealed task identity
              </div>
              <p className="mt-1.5 text-sm font-medium leading-snug">
                Explain SpeakEasy’s new product story
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                lane ⌘⌥1 · id 019f…a4c1
              </p>
            </div>

            <div className="grid lg:grid-cols-2">
              {/* Listen half */}
              <div className="border-b border-slate-100 bg-gradient-to-b from-emerald-50/50 to-white p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  <Mic className="h-3.5 w-3.5" />
                  Listen
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">Deliberate utterance</p>
                <p className="mt-1 text-xs text-slate-500">Local transcription on the Mac</p>

                <div className="mt-8 rounded-2xl border border-emerald-200/80 bg-white/80 p-4 shadow-sm">
                  <Waveform tone="emerald" />
                  <p className="mt-3 text-center text-sm italic text-slate-700">
                    “Make the readiness table unmistakable.”
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                    <Mic className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-900">⌃⌥Space</p>
                    <p className="text-[11px] text-slate-500">Begin / end one utterance</p>
                  </div>
                </div>
              </div>

              {/* Speak half */}
              <div className="bg-gradient-to-b from-white to-blue-50/40 p-6 sm:p-8">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  <AudioLines className="h-3.5 w-3.5" />
                  Speak
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">Native player output</p>
                <p className="mt-1 text-xs text-slate-500">Queue · speed · volume · HUD</p>

                <div className="mt-8 rounded-2xl border border-blue-200/80 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Headphones className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        Codex response · lane 1
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        Stable 0.2.17 ships the player. Exact-task listening is a source-built
                        technical preview on master.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-400">
                      <span>0:18</span>
                      <span>0:43</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                      <span className="sr-only">Previous</span>
                      <span className="block h-0 w-0 border-y-[5px] border-r-[6px] border-y-transparent border-r-slate-500" />
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
                      <span className="sr-only">Pause</span>
                      <span className="flex gap-1">
                        <span className="h-3.5 w-1 bg-white" />
                        <span className="h-3.5 w-1 bg-white" />
                      </span>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                      <span className="sr-only">Next</span>
                      <span className="block h-0 w-0 border-y-[5px] border-l-[6px] border-y-transparent border-l-slate-500" />
                    </span>
                  </div>
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-white ring-1 ring-slate-800">
                  <LockKeyhole className="h-3 w-3 text-emerald-300" />
                  Exact task
                </span>
                <ArrowRight className="hidden h-3.5 w-3.5 text-slate-300 sm:block" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
                  <AudioLines className="h-3 w-3 text-blue-600" />
                  Speak
                </span>
              </div>
              <p className="text-xs font-medium text-slate-800 sm:text-right">
                Speak to Codex. Hear it answer.
              </p>
            </div>
          </div>
        </div>

        {/* Supporting row */}
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              title: "No shadow thread",
              body: "Codex owns and continues the real task. SpeakEasy does not create a parallel conversation.",
            },
            {
              title: "Fail-closed routing",
              body: "If the task lock, protocol, or ownership proof breaks, SpeakEasy stops instead of guessing.",
            },
            {
              title: "Codex first · Claude next",
              body: "Claude hooks already provide one-way spoken notifications. The same two-way contract is intended for Claude next.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
