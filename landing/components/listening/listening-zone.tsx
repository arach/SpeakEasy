import { ArrowUpRight, FlaskConical } from "lucide-react"
import ListeningPrivacy from "@/components/listening/listening-privacy"
import ReleaseStatusStrip from "@/components/listening/release-status-strip"
import VoiceLanes from "@/components/listening/voice-lanes"
import VoiceTurn from "@/components/listening/voice-turn"
import { RELEASE } from "@/lib/release-status"

export default function ListeningZone() {
  return (
    <section id="listening" className="relative scroll-mt-20 overflow-hidden border-t border-white/10 bg-slate-950 px-4 text-white">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" aria-hidden="true" />
      <div className="absolute left-1/2 top-0 h-72 w-[48rem] -translate-x-1/2 bg-emerald-400/[0.035] blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl">
        <header className="pb-12 pt-20 text-center md:pb-14 md:pt-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Listening preview · Build from source
          </div>
          <h2 className="font-display text-4xl font-extralight tracking-tight text-white md:text-6xl">
            Talk back to one exact task
          </h2>
          <p className="mx-auto mt-6 max-w-3xl font-text text-lg font-light leading-relaxed text-slate-300 md:text-xl">
            Lock SpeakEasy to a Codex Desktop task, speak one utterance, and the transcript goes to that task — not a
            new one. The response comes back in your configured voice.
          </p>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-relaxed text-slate-400">
            Codex Desktop owns the conversation. SpeakEasy is a conduit: it does not run its own session, infer which
            task you meant, or listen when you have not asked it to.
          </p>
        </header>

        <VoiceLanes />
        <VoiceTurn />
        <ListeningPrivacy />

        <footer className="border-t border-white/[0.06] py-12 md:py-16">
          <ReleaseStatusStrip variant="zone" className="mb-8" />
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <a
              href="/docs/listening-mode/"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition-colors hover:text-emerald-200"
            >
              Build the technical preview from current sources
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <code className="max-w-full overflow-x-auto rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-left text-xs text-slate-300">
              git clone https://github.com/arach/SpeakEasy.git{" && "}cd SpeakEasy/app{" && "}./build-app.sh
            </code>
            <a
              href={RELEASE.appDmg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 transition-colors hover:text-slate-300"
            >
              See GitHub Releases for what shipped when
            </a>
          </div>
        </footer>
      </div>
    </section>
  )
}
