import Image from "next/image"
import { ArrowRight, AudioLines, Captions, CornerUpLeft, ListMusic, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const capabilities = [
  {
    icon: AudioLines,
    title: "Resident menu-bar player",
    body: "The companion app sits in the macOS menu bar and keeps playing while you work.",
  },
  {
    icon: ListMusic,
    title: "Autoplay and queueing",
    body: "Speech from the CLI or your skills lands in Up Next and starts on its own.",
  },
  {
    icon: SlidersHorizontal,
    title: "Transport, speed, volume",
    body: "Play, pause, seek, and skip — with playback speed and volume in the same popover.",
  },
  {
    icon: Captions,
    title: "Word-synced HUD",
    body: "A floating overlay follows the narration word by word, waveform and all.",
  },
  {
    icon: CornerUpLeft,
    title: "Back to Codex",
    body: "One click from the HUD returns you to the task that queued the speech.",
  },
]

export default function AgentPlayerSection() {
  return (
    <section id="agent-player" className="relative scroll-mt-20 px-4 py-16 bg-gradient-to-b from-white/0 via-emerald-50/30 to-slate-50/50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(16,185,129,0.06),transparent_55%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 border-slate-200 text-slate-600 bg-white/50 rounded-xl hidden sm:inline-block">
            macOS companion app
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extralight mb-4 text-slate-900">
            Speech that
            <span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> lives in your menu bar</span>
          </h2>
          <p className="font-text text-lg text-slate-600 max-w-2xl mx-auto font-light">
            Install the companion app and every <code className="font-mono text-[0.9em] text-emerald-700">speakeasy</code> call
            hands off to a resident player — with a queue, real transport controls, and a HUD that follows the narration.
          </p>
        </div>

        {/* Real, unretouched screenshots of the current macOS app build */}
        <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 lg:p-10 shadow-xl shadow-slate-300/50">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:gap-12 lg:items-start">
            <figure className="mx-auto w-full max-w-[320px] lg:mx-0">
              <Image
                src="/screenshots/menu-bar-player.png"
                alt="SpeakEasy's macOS menu-bar player popover: an Idle status pill, 'Nothing playing — enqueue speech from the CLI or skills', a playback scrubber, stop, previous, play and next transport buttons, volume at 80 percent, playback speed 1×, an Autoplay next toggle switched on, an empty Up Next queue, and Settings and Quit buttons."
                width={320}
                height={449}
                className="w-full rounded-xl ring-1 ring-white/10 shadow-2xl shadow-black/60"
                sizes="320px"
              />
              <figcaption className="mt-4 text-center text-xs leading-relaxed text-slate-400 lg:text-left">
                The menu-bar popover — everything the player does, one click from the status item.
              </figcaption>
            </figure>

            <div>
              <figure className="mx-auto w-full max-w-[526px] lg:mx-0">
                <Image
                  src="/screenshots/narration-hud.png"
                  alt="SpeakEasy's floating narration HUD: the sentence currently being spoken with the live word in bold, a real-time audio waveform, and a 'Back to Codex' button."
                  width={526}
                  height={226}
                  className="w-full"
                  sizes="(min-width: 1024px) 526px, 100vw"
                />
                <figcaption className="mt-4 text-xs leading-relaxed text-slate-400">
                  The floating HUD while the CLI speaks — the words track playback, the waveform reacts to the audio, and
                  Back to Codex is one click away.
                </figcaption>
              </figure>

              <ul className="mt-8 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2">
                {capabilities.map(({ icon: Icon, title, body }, index) => (
                  <li
                    key={title}
                    className={`flex gap-3 ${index === capabilities.length - 1 ? "sm:col-span-2" : ""}`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-white">{title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <code className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-700 shadow-sm">
            speakeasy --app
          </code>
          <a
            href="https://github.com/arach/SpeakEasy#macos-companion-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md"
          >
            Install and open the app
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Installs the signed app to <span className="font-mono">~/.speakeasy/SpeakEasy.app</span> · macOS only
        </p>
      </div>
    </section>
  )
}
