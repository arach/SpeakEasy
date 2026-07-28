"use client"

import { useState } from "react"
import { ArrowDown, ArrowRight, Mic, Radio, Send, Square, Volume2 } from "lucide-react"

const steps = [
  { label: "Ready", detail: "Lock validated. Nothing is listening.", icon: Square },
  { label: "Recording", detail: "Toggle opens the mic. Toggle again to end. 120-second ceiling.", icon: Mic },
  { label: "Transcribing", detail: "On device with Vox / Parakeet; Apple Speech while the model warms.", icon: Radio },
  { label: "Submitting", detail: "Sent once to the locked task id. Empty transcripts never submit.", icon: Send },
  { label: "Speaking", detail: "The real response, in the configured provider and voice.", icon: Volume2 },
  { label: "Ready", detail: "Playback ends and the lock returns to ready. No automatic re-arm.", icon: Square },
] as const

export default function VoiceTurn() {
  const [activeStep, setActiveStep] = useState(0)
  const active = steps[activeStep]

  return (
    <section aria-labelledby="voice-turn-heading" className="border-t border-white/[0.06] py-16 md:py-20">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">One explicit utterance</p>
          <h3 id="voice-turn-heading" className="font-display text-3xl font-light text-white md:text-4xl">
            A voice turn with a clear beginning and end
          </h3>
          <p className="mt-4 max-w-2xl font-text leading-relaxed text-slate-400">
            Listening is a hotkey toggle, not push-to-talk. Each turn moves through visible states, submits once, and
            returns to ready without listening again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveStep((current) => (current + 1) % steps.length)}
          className="w-fit rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-200 transition-colors duration-150 hover:bg-emerald-400/15 focus-visible:ring-emerald-400 focus-visible:ring-offset-0"
        >
          Step through the loop
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <div>
          <ol className="grid gap-3 lg:grid-cols-6 lg:gap-2" aria-label="Listening turn states">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === activeStep

              return (
                <li key={`${step.label}-${index}`} className="relative flex gap-3 lg:block">
                  <div
                    className={`flex-1 rounded-xl border p-4 transition-[border-color,background-color,transform] duration-150 motion-reduce:transition-none ${
                      isActive
                        ? "-translate-y-0.5 border-emerald-400/50 bg-emerald-400/10 motion-reduce:translate-y-0"
                        : "border-white/10 bg-white/[0.025]"
                    }`}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <span className={`font-silkscreen text-[10px] ${isActive ? "text-emerald-300" : "text-slate-400"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Icon className={`h-4 w-4 ${isActive ? "text-emerald-300" : "text-slate-400"}`} aria-hidden="true" />
                    </div>
                    <span className="block text-sm font-medium text-slate-100">{step.label}</span>
                    <span className="mt-2 block text-xs leading-relaxed text-slate-400">{step.detail}</span>
                  </div>
                  {index < steps.length - 1 ? (
                    <>
                      <ArrowDown className="mt-2 h-4 w-4 shrink-0 text-slate-600 lg:hidden" aria-hidden="true" />
                      <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-3 w-3 -translate-y-1/2 text-slate-600 lg:block" aria-hidden="true" />
                    </>
                  ) : null}
                </li>
              )
            })}
          </ol>

          <p aria-live="polite" className="mt-4 text-sm text-slate-400">
            Current diagram state: <span className="font-medium text-emerald-300">{active.label}</span> — {active.detail}
          </p>

          <ul className="mt-8 grid gap-3 text-sm leading-relaxed text-slate-400 md:grid-cols-2">
            {[
              ["Half duplex", "Recording stops SpeakEasy playback first, so it never transcribes its own narration."],
              ["Barge-in", "The hotkey during narration stops playback and starts a new utterance."],
              ["Lock snapshot", "A focus change in the middle of a turn cannot redirect the utterance."],
              ["Visible failure", "A provider error is shown instead of silently switching to the macOS system voice."],
            ].map(([title, detail]) => (
              <li key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                <span className="font-medium text-slate-200">{title}.</span> {detail}
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5" aria-label="HUD behavior diagram">
          <div className="mb-5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-400">
            <span>HUD behavior</span>
            <span>Diagram · not app UI</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-4 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
              <span className="text-emerald-300">Lane 2 · Speaking</span>
              <span className="text-slate-400">Locked</span>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-100">SpeakEasy listening</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              The response is playing in the lane&apos;s configured voice. The HUD shows state and task context.
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-[11px] text-slate-400">Validated task id present</span>
              <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-slate-200">Back to Codex</span>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            “Back to Codex” appears only when the player receives a validated source task id.
          </p>
        </aside>
      </div>
    </section>
  )
}

