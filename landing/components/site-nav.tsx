import Link from "next/link"
import { Github, Waves } from "lucide-react"

export default function SiteNav() {
  return (
    <nav className="relative z-30 border-b border-slate-200/70 bg-white/85 px-5 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
            <Waves className="h-4 w-4 text-emerald-600" />
          </span>
          <span className="font-silkscreen text-sm tracking-[-0.01em] text-slate-900">SpeakEasy</span>
        </Link>

        <div className="hidden items-center gap-7 text-xs text-slate-500 md:flex">
          <Link href="/#dual-mode" className="transition hover:text-slate-900">Dual mode</Link>
          <Link href="/codex/" className="transition hover:text-slate-900">Codex</Link>
          <Link href="/docs/" className="transition hover:text-slate-900">Docs</Link>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/arach/SpeakEasy"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SpeakEasy on GitHub"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            <Github className="h-4 w-4" />
          </a>
          <Link href="/codex/" className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800">
            Try Codex
          </Link>
        </div>
      </div>
    </nav>
  )
}
