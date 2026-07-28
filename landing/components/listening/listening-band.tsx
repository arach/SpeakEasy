import { ArrowUpRight, FlaskConical } from "lucide-react"
import ReleaseStatusStrip from "@/components/listening/release-status-strip"

const refusals = ["No wake word.", "No ambient listening.", "No guessing which task you meant."]

export default function ListeningBand() {
  return (
    <section id="listening" className="relative scroll-mt-20 overflow-hidden border-y border-white/10 bg-slate-950 px-4 py-20 text-white md:py-24">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 h-72 w-[44rem] -translate-x-1/2 -translate-y-1/2 bg-emerald-400/[0.035] blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Listening preview · Build from source
            </div>
            <h2 className="font-display text-4xl font-extralight tracking-tight text-white md:text-6xl">Talk back to one exact task</h2>
            <p className="mt-6 max-w-3xl text-lg font-light leading-relaxed text-slate-300">
              Codex Desktop owns the conversation. SpeakEasy is a conduit: it does not run its own session, guess
              which task you meant, or listen when you have not asked it to.
            </p>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-400">
              Input is explicit and half duplex: one mic capture is transcribed locally with Parakeet, with Apple
              Speech available while the model warms, then routed to the locked task. The detailed lane,
              hotkey-toggle, and microphone workflow lives in the listening-mode docs.
            </p>
            <a
              href="https://voxd.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Listening powered by Vox ↗
            </a>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <ul className="space-y-4 text-sm text-slate-200">
              {refusals.map((refusal) => (
                <li key={refusal} className="border-b border-white/[0.07] pb-4 last:border-0 last:pb-0">{refusal}</li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/[0.07] pt-6">
              <a href="/docs/listening-mode/" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200">
                Read the listening-mode guide <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <code className="mt-4 block overflow-x-auto whitespace-nowrap rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-slate-400">
                cd app{" && "}./build-app.sh
              </code>
            </div>
          </div>
        </div>

        <ReleaseStatusStrip variant="zone" className="mt-12 border-t border-white/[0.07] pt-8" />
      </div>
    </section>
  )
}
