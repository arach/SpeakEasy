import { AudioLines, LockKeyhole, Mic, Route } from "lucide-react"
import ReadinessStrip from "./readiness-strip"

function WaveBars({ tone = "in" }: { tone?: "in" | "out" }) {
  const bars = [22, 42, 30, 56, 38, 64, 28, 48, 34, 52, 26, 44, 36, 50, 20]
  const color =
    tone === "in"
      ? "bg-gradient-to-t from-emerald-600 to-emerald-300"
      : "bg-gradient-to-t from-blue-600 to-blue-300"
  return (
    <div className="flex items-end justify-center gap-[3px] h-14" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${color} motion-safe:animate-pulse`}
          style={{
            height: `${h}%`,
            animationDelay: `${i * 60}ms`,
            opacity: 0.5 + (i % 5) * 0.08,
          }}
        />
      ))}
    </div>
  )
}

export default function VariationWave() {
  return (
    <section
      id="wave"
      aria-labelledby="wave-title"
      className="scroll-mt-40 border-b border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-emerald-700">
              VARIATION 01
            </p>
            <h2
              id="wave-title"
              className="mt-2 font-display text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl"
            >
              Addressed Wave
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              A waveform only becomes useful when it is addressed to one exact Codex task—like a
              letter that carries its destination inside the envelope.
            </p>
          </div>
          <ReadinessStrip />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Destination first
            </p>
            <h3 className="mt-4 font-display text-4xl font-extralight leading-[1.02] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Voice is a signal.{" "}
              <span className="block bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text font-light text-transparent">
                The lock is the address.
              </span>
            </h3>
            <p className="mt-6 max-w-xl text-base font-light leading-7 text-slate-600 sm:text-lg">
              Press <span className="font-medium text-slate-800">⌃⌥Space</span> and speak. Your
              utterance is transcribed locally, then routed only if the active lane holds a validated
              Codex task identity.
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

          {/* Routing diagram */}
          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-100/50 via-white/40 to-blue-100/40 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-5">
                {/* Input capsule */}
                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <Mic className="h-3.5 w-3.5" />
                      Your utterance
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                      local ASR
                    </span>
                  </div>
                  <div className="mt-4">
                    <WaveBars tone="in" />
                  </div>
                  <p className="mt-3 text-center text-sm italic text-slate-700">
                    “Make the readiness table unmistakable.”
                  </p>
                </div>

                {/* Lock gate */}
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-300" aria-hidden="true" />
                  <div className="relative mx-auto max-w-xs rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-center text-white shadow-xl">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                      <LockKeyhole className="h-3.5 w-3.5" />
                      Exact-task lock
                    </div>
                    <p className="mt-1.5 text-sm font-medium">Explain SpeakEasy’s new product story</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      lane ⌘⌥1 · id 019f…a4c1
                    </p>
                  </div>
                </div>

                {/* Output capsule */}
                <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/60 to-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                      <AudioLines className="h-3.5 w-3.5" />
                      Codex response
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                      native TTS
                    </span>
                  </div>
                  <div className="mt-4">
                    <WaveBars tone="out" />
                  </div>
                  <p className="mt-3 text-center text-sm text-slate-700">
                    “Stable player ships now. Listening is a source-built technical preview.”
                  </p>
                </div>

                {/* Routing label */}
                <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] text-slate-200">
                  <Route className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>
                    Transcript enters the locked task once. Fail-closed if ownership or protocol
                    cannot be proven.
                  </span>
                </div>
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
