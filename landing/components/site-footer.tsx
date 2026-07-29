import Link from "next/link"
import { Waves } from "lucide-react"

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#080a09] px-5 py-10 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
            <Waves className="h-4 w-4 text-mint" />
            SpeakEasy
          </div>
          <p className="mt-3 max-w-md text-xs leading-5 text-white/32">
            An exact-task voice layer for coding agents. Built for macOS by Arach.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/38">
          <Link href="/docs/" className="transition hover:text-white">Docs</Link>
          <Link href="/support/" className="transition hover:text-white">Support</Link>
          <Link href="/privacy/" className="transition hover:text-white">Privacy</Link>
          <Link href="/terms/" className="transition hover:text-white">Terms</Link>
          <a href="https://github.com/arach/SpeakEasy" className="transition hover:text-white">GitHub</a>
        </div>
      </div>
    </footer>
  )
}
