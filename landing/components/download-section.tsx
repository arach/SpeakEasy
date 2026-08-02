import Link from "next/link"
import { Check, Download, ExternalLink, Laptop, ShieldCheck, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  releaseChecksumUrl,
  releaseDownloadUrl,
  releasePageUrl,
  releaseRequirements,
  releaseVersion,
} from "@/lib/release"

const steps = [
  ["1", "Give Codex the prompt", "It downloads and inspects the pinned release installer—never a floating latest build."],
  ["2", "Let it verify everything", "Checksum, Gatekeeper, Developer ID, version, and safe app replacement are checked in order."],
  ["3", "Approve the human steps", "You grant microphone and local-network access; Settings verifies Codex and the live bridge."],
]

export default function DownloadSection() {
  return (
    <section id="download" className="relative overflow-hidden border-y border-slate-200/60 bg-slate-950 px-4 py-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.11),transparent_28%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-end gap-12 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <Badge variant="outline" className="rounded-xl border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
              Self-serve preview · {releaseVersion}
            </Badge>
            <h2 className="mt-6 max-w-3xl font-display text-5xl font-extralight leading-[0.98] tracking-tight sm:text-6xl">
              Download the complete
              <span className="block bg-gradient-to-r from-emerald-300 to-blue-300 bg-clip-text text-transparent">
                Codex voice loop.
              </span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg font-light leading-8 text-white/58">
              No repository, Bun, Xcode, or server setup. Give Codex one bounded installation task; it verifies and opens the notarized app, then tells you exactly which human permissions remain.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-xl bg-emerald-300 px-6 font-semibold text-slate-950 hover:bg-emerald-200">
                <Link href="/codex/#codex-install">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Install with Codex
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl border-white/15 bg-white/[0.04] px-6 text-white hover:bg-white/[0.08] hover:text-white">
                <a href={releaseDownloadUrl}>
                  <Download className="mr-2 h-4 w-4" />
                  Download DMG
                </a>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/36">
              <span>{releaseRequirements.platform}</span>
              <span>{releaseRequirements.os}</span>
              <span>Codex Desktop</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/35 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
                  <Laptop className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold">Codex-assisted setup</div>
                  <div className="mt-0.5 text-xs text-white/35">Automation with explicit trust checks</div>
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>

            <ol className="divide-y divide-white/8">
              {steps.map(([number, title, body]) => (
                <li key={number} className="flex gap-4 px-6 py-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] font-mono text-[11px] text-emerald-300">
                    {number}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {title}
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-white/42">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/8 px-6 py-4 text-[11px] text-white/38">
              <a href={releasePageUrl} className="inline-flex items-center gap-1.5 transition hover:text-white">
                Release notes <ExternalLink className="h-3 w-3" />
              </a>
              <a href={releaseChecksumUrl} className="inline-flex items-center gap-1.5 transition hover:text-white">
                SHA-256 <Sparkles className="h-3 w-3" />
              </a>
              <span>Signed + notarized</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
