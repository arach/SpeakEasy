import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleDot,
  Download,
  Headphones,
  LockKeyhole,
  Mic2,
  ShieldCheck,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react"
import SiteFooter from "@/components/site-footer"
import SiteNav from "@/components/site-nav"

const releaseUrl = "https://github.com/arach/SpeakEasy/releases/latest/download/SpeakEasy.dmg"

function LoopStep({
  number,
  label,
  detail,
  active = false,
}: {
  number: string
  label: string
  detail: string
  active?: boolean
}) {
  return (
    <div className="group relative flex min-w-0 flex-1 items-start gap-3">
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] ${
          active
            ? "border-mint/60 bg-mint text-ink-inverse shadow-[0_0_30px_rgba(79,222,176,0.22)]"
            : "border-white/12 bg-white/[0.04] text-white/55"
        }`}
      >
        {number}
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="mt-1 text-xs leading-5 text-white/42">{detail}</div>
      </div>
    </div>
  )
}

function VoiceLoopVisual() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d100f] shadow-[0_50px_140px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-mint/20 bg-mint/10">
            <Waves className="h-4 w-4 text-mint" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Conversation</div>
            <div className="text-[11px] text-white/38">Exact task voice loop</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-mint/15 bg-mint/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
          Ready
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5">
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">
                <LockKeyhole className="h-3 w-3 text-mint" />
                Locked Codex task
              </div>
              <div className="truncate text-base font-medium text-white">Ship the dual-mode story</div>
              <div className="mt-1 truncate font-mono text-[11px] text-white/35">~/dev/SpeakEasy · task 019f…</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-xs text-white/60">
              ⌘⌥1
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-mint/18 bg-mint/[0.055] p-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-mint text-ink-inverse shadow-[0_0_0_7px_rgba(79,222,176,0.06)]">
            <Mic2 className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0d100f] bg-[#ff6b72]" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">“Explain the architecture in plain English.”</div>
            <div className="mt-2 flex items-end gap-1" aria-hidden="true">
              {[7, 12, 18, 10, 23, 15, 8, 19, 13, 6, 16, 9, 21, 11, 7].map((height, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-mint/65"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-1 text-[11px] text-white/36">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/12" />
          transcribed locally · sent once · exact task
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/12" />
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
              <Sparkles className="h-4 w-4 text-mint" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">Codex responds</div>
              <p className="mt-2 text-sm leading-6 text-white/72">
                SpeakEasy keeps the Mac in charge: your voice enters the task you chose, then the task’s real response returns through the player.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-ink-inverse" aria-label="Play response preview">
              <Volume2 className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center gap-1" aria-hidden="true">
              {[5, 9, 6, 14, 8, 18, 10, 6, 15, 9, 5, 12, 7, 16, 8, 5, 11, 6, 9, 4].map((height, index) => (
                <span key={index} className="flex-1 rounded-full bg-white/22" style={{ height: `${height}px` }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-white/35">1×</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModeCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  facts,
  status,
}: {
  eyebrow: string
  title: string
  description: string
  icon: typeof Mic2
  facts: string[]
  status: string
}) {
  return (
    <article className="group relative overflow-hidden border-t border-white/12 py-10 md:py-14">
      <div className="grid gap-8 md:grid-cols-[0.78fr_1.22fr] md:gap-14">
        <div>
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-mint/20 bg-mint/8">
            <Icon className="h-5 w-5 text-mint" />
          </div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-mint/80">{eyebrow}</div>
          <h3 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-white md:text-4xl">{title}</h3>
        </div>
        <div>
          <p className="max-w-xl text-lg leading-8 text-white/58">{description}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <li key={fact} className="flex items-start gap-2.5 text-sm leading-6 text-white/58">
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-mint" />
                {fact}
              </li>
            ))}
          </ul>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
            <CircleDot className="h-3 w-3 text-mint" />
            {status}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-white">
      <SiteNav />

      <section className="relative border-b border-white/8 px-5 pb-24 pt-16 md:px-8 md:pb-32 md:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(79,222,176,0.10),transparent_27%),radial-gradient(circle_at_8%_70%,rgba(69,126,255,0.055),transparent_25%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:80px_80px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/[0.06] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">
              <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_12px_rgba(79,222,176,0.8)]" />
              Two-way voice for Codex · technical preview
            </div>
            <h1 className="max-w-3xl text-[clamp(3.75rem,8vw,7.4rem)] font-medium leading-[0.88] tracking-[-0.07em] text-white">
              Speak to Codex.
              <span className="block text-white/36">Hear it answer.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/58 md:text-xl md:leading-9">
              A two-way voice layer for serious work: local speech recognition in, controllable narration out, locked to the Codex task you choose.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/install/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-5 py-3.5 text-sm font-semibold text-ink-inverse transition hover:bg-[#67e6bd]"
              >
                Install SpeakEasy
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={releaseUrl}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.035] px-5 py-3.5 text-sm font-medium text-white/72 transition hover:border-white/25 hover:bg-white/[0.065] hover:text-white"
              >
                <Download className="h-4 w-4" />
                Download signed app
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.13em] text-white/32">
              <span>macOS 14+</span>
              <span>Local transcription</span>
              <span>No API key required</span>
            </div>
          </div>

          <VoiceLoopVisual />
        </div>

        <div className="relative mx-auto mt-20 max-w-7xl border-t border-white/10 pt-8 md:mt-28">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
            <LoopStep number="01" label="Speak" detail="One explicit utterance" active />
            <LoopStep number="02" label="Transcribe" detail="On your Mac" />
            <LoopStep number="03" label="Route" detail="To the exact task" />
            <LoopStep number="04" label="Respond" detail="In the real thread" />
            <LoopStep number="05" label="Listen" detail="In the native player" />
          </div>
        </div>
      </section>

      <section id="dual-mode" className="px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">One system · two modes</div>
            <div>
              <h2 className="max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-white md:text-6xl">
                Voice goes in. The real answer comes back.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/50">
                ASR and TTS are not separate demos. SpeakEasy joins them around the conversation that already owns your work.
              </p>
            </div>
          </div>

          <div className="mt-20">
            <ModeCard
              eyebrow="Listen · ASR"
              title="Your voice becomes the next turn."
              description="Press once to record and again to send. SpeakEasy transcribes the utterance locally, validates the task lock, and submits exactly once to the Codex Desktop conversation you selected."
              icon={Mic2}
              facts={[
                "Embedded Vox / Parakeet transcription",
                "Explicit capture — never ambient",
                "Dedicated microphone selection",
                "Temporary audio deleted after use",
              ]}
              status="Technical preview on master"
            />
            <ModeCard
              eyebrow="Speak · TTS"
              title="Every answer has a place to land."
              description="The task’s final response returns through a permanent native menu-bar player. Autoplay it, queue it, scrub it, slow it down, follow the words in the HUD, or jump back to the source task."
              icon={Headphones}
              facts={[
                "macOS system voice with no account",
                "OpenAI, ElevenLabs, Groq, and Gemini",
                "Queue, transport, volume, and speed",
                "Word-synced HUD and task return link",
              ]}
              status="Available now in 0.2.17"
            />
          </div>
        </div>
      </section>

      <section id="codex" className="border-y border-white/8 bg-white/[0.018] px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-24">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Deep Codex integration</div>
            <h2 className="mt-5 text-4xl font-medium leading-[1.03] tracking-[-0.045em] text-white md:text-6xl">
              Conversation, not voice commands.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/52">
              SpeakEasy does not start a second agent or paste into whichever window happens to be focused. It follows the exact Desktop-owned task from utterance to response.
            </p>

            <div className="mt-10 rounded-2xl border border-amber-300/16 bg-amber-200/[0.035] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-100/80">
                <ShieldCheck className="h-4 w-4" />
                Technical-preview boundary
              </div>
              <p className="mt-3 text-sm leading-6 text-white/46">
                The current bridge uses private, version-checked Codex Desktop IPC. It verifies ownership and fails closed on a mismatch. It is not presented as a supported public Codex API.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-white/8 pb-5">
              <div>
                <div className="text-sm font-semibold text-white">Voice lanes</div>
                <div className="mt-1 text-xs text-white/34">Nine persistent exact-task assignments</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] text-white/45">⌘⌥1…9</div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                ["1", "Website story", "active"],
                ["2", "Native player", "ready"],
                ["3", "Plugin release", "ready"],
                ["4", "Pad protocol", "idle"],
                ["5", "Claude adapter", "next"],
                ["6", "Docs", "idle"],
                ["7", "Open", "empty"],
                ["8", "Open", "empty"],
                ["9", "Open", "empty"],
              ].map(([number, label, state]) => (
                <div
                  key={number}
                  className={`min-h-24 rounded-xl border p-3 transition ${
                    state === "active"
                      ? "border-mint/40 bg-mint/[0.09]"
                      : state === "empty"
                        ? "border-dashed border-white/8 bg-transparent"
                        : "border-white/8 bg-white/[0.025]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-xs ${state === "active" ? "text-mint" : "text-white/35"}`}>{number}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${state === "active" ? "bg-mint" : state === "next" ? "bg-amber-300/70" : "bg-white/16"}`} />
                  </div>
                  <div className={`mt-6 truncate text-xs ${state === "empty" ? "text-white/20" : "text-white/58"}`}>{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/42">
              <span>Current lane</span>
              <span className="flex items-center gap-2 font-mono text-white/58">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                1 · Website story
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="trust" className="px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Designed to stay legible</div>
            <h2 className="mt-5 text-4xl font-medium leading-[1.03] tracking-[-0.045em] text-white md:text-6xl">
              The Mac stays in charge.
            </h2>
          </div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
            {[
              {
                icon: LockKeyhole,
                title: "Explicit task locks",
                body: "Task ID is routing authority. Titles, recency, and focus are display context—not guesses.",
              },
              {
                icon: ShieldCheck,
                title: "Local first",
                body: "Transcription happens on the Mac. System narration works offline; cloud voices are an explicit provider choice.",
              },
              {
                icon: AudioLines,
                title: "Half duplex by design",
                body: "Starting an utterance stops SpeakEasy playback so it cannot transcribe its own narration.",
              },
            ].map((item) => (
              <article key={item.title} className="bg-[#0a0c0b] p-7 md:p-9">
                <item.icon className="h-5 w-5 text-mint" />
                <h3 className="mt-8 text-xl font-medium text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/45">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="claude" className="border-y border-white/8 bg-[#0d100f] px-5 py-24 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-[1fr_0.82fr] md:gap-20">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Expansion path</div>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] text-white md:text-6xl">Codex first. Claude next.</h2>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/52">
              Claude hooks can already turn permissions and waiting states into spoken notifications. The next step is to carry the same explicit Listen → exact conversation → Speak loop into Claude without weakening the routing model.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center gap-4 rounded-2xl border border-mint/20 bg-mint/[0.055] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-ink-inverse"><Check className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-medium text-white">Claude hooks speak today</div>
                <div className="mt-1 text-xs text-white/38">Permissions, status, and waiting notifications</div>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/9 bg-white/[0.025] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-white/16 text-white/42"><ArrowRight className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-medium text-white/68">Two-way Claude adapter next</div>
                <div className="mt-1 text-xs text-white/32">Same deliberate conversation contract</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-mint/18 bg-[radial-gradient(circle_at_80%_20%,rgba(79,222,176,.14),transparent_30%),#101311] p-8 sm:p-12 md:p-16">
          <div className="grid items-end gap-10 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Start with the stable layer</div>
              <h2 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-white md:text-6xl">
                Give your work a voice.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/48">
                Install the signed Mac app for narration now, add the CLI for scripts, or build the current source to try exact-task listening.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link href="/install/" className="inline-flex w-full items-center justify-between rounded-xl bg-mint px-5 py-4 text-sm font-semibold text-ink-inverse md:max-w-xs">
                See all installation paths
                <ChevronRight className="h-4 w-4" />
              </Link>
              <a href={releaseUrl} className="inline-flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.035] px-5 py-4 text-sm font-medium text-white/66 md:max-w-xs">
                Download SpeakEasy.dmg
                <Download className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
