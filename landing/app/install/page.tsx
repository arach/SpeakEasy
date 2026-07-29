import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Download,
  ExternalLink,
  Github,
  Headphones,
  Info,
  Mic2,
  PackageCheck,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react"
import SiteFooter from "@/components/site-footer"
import SiteNav from "@/components/site-nav"

export const metadata: Metadata = {
  title: "Install SpeakEasy",
  description: "Install the signed SpeakEasy Mac app, CLI and SDK, or build the exact-task Codex listening technical preview.",
}

const releaseUrl = "https://github.com/arach/SpeakEasy/releases/latest/download/SpeakEasy.dmg"

function CommandBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-white/9 bg-black/35 p-4 font-mono text-xs leading-6 text-white/64">
      <code>{children}</code>
    </pre>
  )
}

function Requirement({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-6 text-white/48">
      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-mint" />
      {children}
    </li>
  )
}

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-canvas text-white">
      <SiteNav />

      <header className="relative overflow-hidden border-b border-white/8 px-5 py-20 md:px-8 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_25%,rgba(79,222,176,0.10),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-white/42 transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the story
          </Link>
          <div className="mt-10 grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-end">
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Install SpeakEasy</div>
              <h1 className="mt-5 max-w-4xl text-5xl font-medium leading-[0.96] tracking-[-0.055em] text-white md:text-7xl">
                Start stable. Try the conversation preview when you’re ready.
              </h1>
            </div>
            <p className="max-w-xl text-base leading-7 text-white/48 md:pb-1">
              SpeakEasy has a stable signed player and TTS runtime today. Exact-task listening is real and merged, but remains a source-built Codex technical preview until the next signed release.
            </p>
          </div>
        </div>
      </header>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-3">
            <article className="flex flex-col rounded-3xl border border-mint/25 bg-mint/[0.055] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.25)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-ink-inverse">
                  <Headphones className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mint">Available now</span>
              </div>
              <h2 className="mt-8 text-2xl font-medium text-white">Signed Mac app</h2>
              <p className="mt-3 min-h-20 text-sm leading-6 text-white/48">
                The permanent player, queue, transport controls, HUD, settings, and stable TTS surface.
              </p>
              <a href={releaseUrl} className="mt-8 inline-flex items-center justify-between rounded-xl bg-mint px-4 py-3.5 text-sm font-semibold text-ink-inverse">
                Download SpeakEasy.dmg
                <Download className="h-4 w-4" />
              </a>
            </article>

            <article className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.025] p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <TerminalSquare className="h-5 w-5 text-mint" />
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/38">Available now</span>
              </div>
              <h2 className="mt-8 text-2xl font-medium text-white">CLI and SDK</h2>
              <p className="mt-3 min-h-20 text-sm leading-6 text-white/48">
                Add speech to scripts, hooks, applications, and agent workflows with the published package.
              </p>
              <a href="#cli" className="mt-8 inline-flex items-center justify-between rounded-xl border border-white/11 bg-white/[0.035] px-4 py-3.5 text-sm font-medium text-white/66">
                Install the package
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>

            <article className="flex flex-col rounded-3xl border border-amber-200/14 bg-amber-100/[0.025] p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200/12 bg-amber-100/[0.04]">
                  <Mic2 className="h-5 w-5 text-amber-100/75" />
                </div>
                <span className="rounded-full border border-amber-200/14 bg-amber-100/[0.035] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-100/60">Technical preview</span>
              </div>
              <h2 className="mt-8 text-2xl font-medium text-white">Codex listening</h2>
              <p className="mt-3 min-h-20 text-sm leading-6 text-white/48">
                Build current source to try local ASR, exact-task locks, and nine persistent conversation lanes.
              </p>
              <a href="#preview" className="mt-8 inline-flex items-center justify-between rounded-xl border border-amber-200/12 bg-amber-100/[0.025] px-4 py-3.5 text-sm font-medium text-amber-50/65">
                Build the preview
                <ArrowRight className="h-4 w-4" />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section id="app" className="border-y border-white/8 bg-white/[0.018] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">01 · Stable app</div>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] text-white">Install the native player.</h2>
            <p className="mt-5 text-sm leading-6 text-white/46">
              The release is Developer ID signed, Apple notarized, and works with the built-in macOS voice before you configure any provider.
            </p>
          </div>
          <div className="grid gap-8">
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Download", "Get the latest SpeakEasy.dmg."],
                ["2", "Install", "Open the DMG and copy SpeakEasy to Applications."],
                ["3", "Launch", "Open SpeakEasy and allow notifications when prompted."],
              ].map(([number, title, body]) => (
                <li key={number} className="rounded-2xl border border-white/9 bg-black/20 p-5">
                  <span className="font-mono text-xs text-mint">{number}</span>
                  <div className="mt-7 text-sm font-medium text-white">{title}</div>
                  <p className="mt-2 text-xs leading-5 text-white/38">{body}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={releaseUrl} className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-5 py-3.5 text-sm font-semibold text-ink-inverse">
                <Download className="h-4 w-4" />
                Download signed app
              </a>
              <a href="https://github.com/arach/SpeakEasy/releases/tag/v0.2.17" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-5 py-3.5 text-sm text-white/58">
                Release details
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="cli" className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">02 · CLI and SDK</div>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] text-white">Make scripts and agents speak.</h2>
            <ul className="mt-7 grid gap-2">
              <Requirement>Bun 1.0+ or Node.js 22.12+</Requirement>
              <Requirement>System voice needs no API key</Requirement>
              <Requirement>Cloud providers are optional</Requirement>
            </ul>
          </div>
          <div className="grid gap-5">
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/34">Bun · recommended</div>
              <CommandBlock>{`bun add -g @arach/speakeasy\n\nspeakeasy "Hello from SpeakEasy" --provider system\nspeakeasy --doctor`}</CommandBlock>
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/34">npm</div>
              <CommandBlock>{`npm install -g @arach/speakeasy\n\nspeakeasy "Build complete" --provider system`}</CommandBlock>
            </div>
            <div className="rounded-2xl border border-white/9 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-white/72"><Code2 className="h-4 w-4 text-mint" /> SDK</div>
              <CommandBlock>{`bun add @arach/speakeasy\n\nimport { say } from "@arach/speakeasy";\nawait say("The task is ready for review.");`}</CommandBlock>
            </div>
          </div>
        </div>
      </section>

      <section id="preview" className="border-y border-white/8 bg-[#0d100f] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/60">03 · Codex technical preview</div>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] text-white">Build the two-way loop.</h2>
            <p className="mt-5 text-sm leading-6 text-white/46">
              The listening code is merged on master but postdates the 0.2.17 signed release. Build it from source while the next signed release and public plugin listing are prepared.
            </p>
          </div>
          <div>
            <div className="rounded-2xl border border-amber-200/14 bg-amber-100/[0.025] p-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-100/65" />
                <p className="text-sm leading-6 text-white/48">
                  This preview talks to private, version-checked Codex Desktop IPC and intentionally fails closed when compatibility cannot be proven. Use it with the current Codex Desktop app, not as a production API contract.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <CommandBlock>{`git clone https://github.com/arach/SpeakEasy.git\ncd SpeakEasy/app\n./build-app.sh\nopen SpeakEasy.app`}</CommandBlock>
            </div>
            <ol className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Open a Codex task", "The task must be owned by Codex Desktop."],
                ["2", "Lock or assign it", "Choose it in SpeakEasy or map it to ⌘⌥1…9."],
                ["3", "Start talking", "Press ⌃⌥Space, speak, then press again to send."],
              ].map(([number, title, body]) => (
                <li key={number} className="rounded-2xl border border-white/8 bg-black/18 p-5">
                  <span className="font-mono text-xs text-amber-100/55">{number}</span>
                  <div className="mt-6 text-sm font-medium text-white">{title}</div>
                  <p className="mt-2 text-xs leading-5 text-white/36">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 md:p-9">
            <PackageCheck className="h-5 w-5 text-mint" />
            <h2 className="mt-7 text-2xl font-medium text-white">Codex plugin status</h2>
            <p className="mt-4 text-sm leading-6 text-white/46">
              The bundled SpeakEasy skill and runtime are packaged and verified, but the public directory listing is still in progress pending publisher verification. There is not yet a public one-click install command to advertise.
            </p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 md:p-9">
            <ShieldCheck className="h-5 w-5 text-mint" />
            <h2 className="mt-7 text-2xl font-medium text-white">Provider privacy</h2>
            <p className="mt-4 text-sm leading-6 text-white/46">
              Local transcription stays on the Mac. The system voice is local too. If you choose a cloud TTS provider, only the text being narrated is sent directly to that provider under its terms.
            </p>
            <Link href="/privacy/" className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-mint">
              Read the privacy policy
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        </div>
      </section>

      <section className="border-t border-white/8 px-5 py-20 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-3xl border border-mint/18 bg-mint/[0.045] p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-3xl font-medium tracking-[-0.035em] text-white">Need the implementation details?</h2>
            <p className="mt-3 text-sm text-white/43">Read the docs or inspect the exact source that powers the app and plugin.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/docs/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-5 py-3.5 text-sm font-semibold text-ink-inverse">
              Open documentation
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="https://github.com/arach/SpeakEasy" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/11 bg-white/[0.03] px-5 py-3.5 text-sm text-white/58">
              <Github className="h-4 w-4" />
              View source
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
