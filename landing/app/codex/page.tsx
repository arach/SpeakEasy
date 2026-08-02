import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Github,
  Headphones,
  Info,
  LockKeyhole,
  Mic2,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import CodexInstallPrompt from "@/components/codex-install-prompt"
import SiteFooter from "@/components/site-footer"
import SiteNav from "@/components/site-nav"
import { releaseDownloadUrl, releaseRequirements, releaseVersion } from "@/lib/release"

export const metadata: Metadata = {
  title: "SpeakEasy for Codex",
  description: "See how SpeakEasy maps your voice to an exact Codex Desktop task and brings its real response back through the native player.",
}

const loop = [
  ["1", "Choose", "Select the Codex task that already owns the work."],
  ["2", "Lock", "SpeakEasy validates that exact task with Codex Desktop."],
  ["3", "Speak", "Press ⌃⌥Space, talk, then press again to send."],
  ["4", "Route", "The final local transcript enters that task exactly once."],
  ["5", "Hear", "Its real response returns through the native player."],
]

export default function CodexPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 text-slate-900">
      <SiteNav />

      <section className="relative border-b border-slate-200/60 px-4 py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(16,185,129,0.08),transparent_30%),radial-gradient(circle_at_78%_70%,rgba(59,130,246,0.06),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_0.92fr]">
          <div>
            <Badge variant="outline" className="rounded-xl border-emerald-200 bg-white/80 text-emerald-700">
              SpeakEasy {releaseVersion} · dual mode
            </Badge>
            <h1 className="mt-6 font-display text-5xl font-extralight leading-[0.98] tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
              One voice.
              <span className="block bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text font-light text-transparent">
                One exact Codex task.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl font-text text-lg font-light leading-8 text-slate-600">
              SpeakEasy maps an explicit utterance to the conversation you choose—not whichever window happens to be focused—then speaks that conversation’s real answer back to you.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-xl bg-slate-900 px-6 text-white hover:bg-slate-800">
                <a href="#codex-install">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Install with Codex
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl border-slate-300 bg-white px-6 text-slate-700">
                <a href={releaseDownloadUrl}><Download className="mr-2 h-4 w-4" />Download DMG</a>
              </Button>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Developer ID signed and Apple-notarized · {releaseRequirements.platform} · {releaseRequirements.os}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <LockKeyhole className="h-4 w-4 text-emerald-600" />
                  Exact-task map
                </div>
                <p className="mt-1 text-xs text-slate-500">Task identity survives every turn</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Ready</span>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-mono text-xs text-white">1</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Locked Codex task</div>
                  <div className="mt-1 truncate text-sm font-semibold text-slate-900">Explain SpeakEasy’s new product story</div>
                  <div className="mt-1 truncate font-mono text-[10px] text-slate-500">~/dev/SpeakEasy · 019f…</div>
                </div>
                <span className="rounded-lg bg-white px-2 py-1 font-mono text-[10px] text-slate-500 shadow-sm">⌘⌥1</span>
              </div>
            </div>

            <div className="my-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              exact ID stays attached
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <Mic2 className="h-4 w-4 text-emerald-600" />
                <div className="mt-5 text-sm font-medium text-slate-900">“Make the distinction clearer.”</div>
                <div className="mt-2 text-xs text-slate-500">Local transcript</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <div className="mt-5 text-sm font-medium text-slate-900">The task responds in context.</div>
                <div className="mt-2 text-xs text-slate-500">Spoken in SpeakEasy</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">The mapping is the product</span>
            <h2 className="mt-4 font-display text-4xl font-extralight text-slate-900 sm:text-5xl">
              SpeakEasy never guesses where your words should go.
            </h2>
            <p className="mt-5 text-lg font-light leading-8 text-slate-600">
              The task ID—not its title, recency, project folder, or current focus—is the routing authority.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: LockKeyhole,
                title: "Explicit lock",
                body: "You choose a real Codex Desktop task. SpeakEasy accepts it only after the owning window validates the exact ID.",
              },
              {
                icon: Route,
                title: "Persistent lanes",
                body: "Map up to nine tasks to Command-Option-1…9. Every activation reopens and revalidates the assignment.",
              },
              {
                icon: ShieldCheck,
                title: "Fail closed",
                body: "If ownership, protocol, task, or turn correlation cannot be proven, SpeakEasy stops instead of picking another route.",
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200/70 bg-white/70 p-7 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-blue-50 text-emerald-600 ring-1 ring-emerald-100">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-7 font-display text-2xl font-medium text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/60 bg-white px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">One complete turn</span>
              <h2 className="mt-4 font-display text-4xl font-extralight text-slate-900 sm:text-5xl">From your voice to the real response.</h2>
              <p className="mt-5 text-base font-light leading-7 text-slate-600">
                ASR and TTS meet around the same task. There is no shadow agent and no second conversation to reconcile later.
              </p>
            </div>
            <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-px before:bg-gradient-to-b before:from-emerald-300 before:to-blue-200">
              {loop.map(([number, title, body], index) => (
                <li key={number} className="relative flex gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                  <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white font-mono text-xs ${index === 0 ? "border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                    {number}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="px-4 py-24">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200/70 bg-white/75 p-8 shadow-lg shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Headphones className="h-5 w-5" /></div>
              <Badge variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700">Included in {releaseVersion}</Badge>
            </div>
            <h2 className="mt-7 font-display text-3xl font-medium text-slate-900">Speak · native TTS</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Responses return through the menu-bar player with queues, transport controls, speed, volume, provider voices, and the live transcript HUD.
            </p>
            <Button asChild className="mt-7 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              <a href={releaseDownloadUrl}><Download className="mr-2 h-4 w-4" />Download SpeakEasy.dmg</a>
            </Button>
          </article>

          <article className="rounded-3xl border border-emerald-200/70 bg-emerald-50/45 p-8 shadow-lg shadow-emerald-900/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Mic2 className="h-5 w-5" /></div>
              <Badge variant="outline" className="rounded-xl border border-emerald-200 bg-white/70 text-emerald-700">Included in {releaseVersion}</Badge>
            </div>
            <h2 className="mt-7 font-display text-3xl font-medium text-slate-900">Listen · local ASR</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Hold to speak from the Mac, browser, or iPad. SpeakEasy transcribes locally and sends the final dictation into the real Codex task assigned to that lane.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> No source checkout or developer tools</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Nine persistent exact-task lanes</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Full transcript remains in Codex</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="setup" className="border-y border-slate-200/60 bg-white px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">First run</span>
            <h2 className="mt-4 font-display text-4xl font-extralight text-slate-900 sm:text-5xl">One prompt. Codex does the rest.</h2>
            <p className="mt-5 text-base font-light leading-7 text-slate-600">
              Paste a pinned install task into Codex. Approve microphone and local-network access when macOS asks.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <CodexInstallPrompt />

            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50/50">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
                <span className="text-xs font-medium text-slate-500">Prefer the DMG?</span>
                <a href={releaseDownloadUrl} className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-600">
                  Download DMG <Download className="h-3.5 w-3.5" />
                </a>
              </div>
              <ol>
              {[
                ["1", "Install", "Open the DMG and drag SpeakEasy to Applications."],
                ["2", "Allow", "Open the app and approve microphone and local-network access when macOS asks."],
                ["3", "Start & talk", "In Settings → Deck, confirm Codex, start Deck, map a task, and hold to speak."],
              ].map(([number, title, body]) => (
                <li key={number} className="flex gap-4 border-b border-slate-200/70 p-5 last:border-b-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-mono text-[11px] text-slate-500">{number}</span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
                  </div>
                </li>
              ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/60 bg-gradient-to-r from-emerald-50/60 to-blue-50/60 px-4 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1fr_0.8fr]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Codex first · Claude next</span>
            <h2 className="mt-4 font-display text-4xl font-extralight text-slate-900">A routing model we can carry back to Claude.</h2>
            <p className="mt-5 max-w-2xl text-base font-light leading-7 text-slate-600">
              Claude hooks already speak permission and waiting notifications. The next step is to adapt this same explicit conversation contract—not invent a looser voice-command layer.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/75 p-6 shadow-lg shadow-slate-900/5">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-800"><Check className="h-4 w-4 text-emerald-600" /> Spoken Claude hooks today</div>
            <div className="my-4 h-px bg-slate-200" />
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500"><ArrowRight className="h-4 w-4 text-blue-500" /> Two-way Claude mapping next</div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-3xl border border-slate-200/70 bg-white/80 p-8 shadow-xl shadow-slate-900/5 md:flex-row md:items-center md:p-10">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Info className="h-4 w-4 text-emerald-600" /> Codex integration boundary</div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              The current bridge uses private, version-checked Codex Desktop IPC and fails closed on incompatibility. It is not presented as a supported public Codex API.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="rounded-xl bg-white">
              <Link href="/docs/">Read the setup docs <ExternalLink className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white">
              <a href="https://github.com/arach/SpeakEasy"><Github className="mr-2 h-4 w-4" />Source</a>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
