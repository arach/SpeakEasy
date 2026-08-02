import Link from "next/link"
import { Waves } from "lucide-react"

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/70 bg-slate-50/60 px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
            <Waves className="h-4 w-4 text-emerald-600" />
            SpeakEasy
          </div>
          <p className="mt-3 max-w-md text-xs leading-5 text-slate-500">
            An exact-task voice layer for coding agents. Built for macOS by Arach.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
          <Link href="/docs/" className="transition hover:text-slate-900">Docs</Link>
          <Link href="/support/" className="transition hover:text-slate-900">Support</Link>
          <Link href="/privacy/" className="transition hover:text-slate-900">Privacy</Link>
          <Link href="/terms/" className="transition hover:text-slate-900">Terms</Link>
          <a href="https://github.com/arach/SpeakEasy" className="transition hover:text-slate-900">GitHub</a>
        </div>
      </div>
    </footer>
  )
}
