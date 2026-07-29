import Link from "next/link"
import { Github, Waves } from "lucide-react"

export default function SiteNav() {
  return (
    <nav className="relative z-30 border-b border-white/8 bg-canvas/90 px-5 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-mint/20 bg-mint/10">
            <Waves className="h-4 w-4 text-mint" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.01em] text-white">SpeakEasy</span>
        </Link>

        <div className="hidden items-center gap-7 text-xs text-white/46 md:flex">
          <Link href="/#dual-mode" className="transition hover:text-white">Dual mode</Link>
          <Link href="/#codex" className="transition hover:text-white">Codex</Link>
          <Link href="/#trust" className="transition hover:text-white">Trust</Link>
          <Link href="/docs/" className="transition hover:text-white">Docs</Link>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/arach/SpeakEasy"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SpeakEasy on GitHub"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-white/55 transition hover:text-white"
          >
            <Github className="h-4 w-4" />
          </a>
          <Link href="/install/" className="rounded-lg bg-mint px-4 py-2.5 text-xs font-semibold text-ink-inverse transition hover:bg-[#67e6bd]">
            Install
          </Link>
        </div>
      </div>
    </nav>
  )
}
