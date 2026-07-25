import type { ReactNode } from "react"
import Link from "next/link"

type LegalPageProps = {
  title: string
  summary: string
  updated: string
  children: ReactNode
}

export function LegalPage({ title, summary, updated, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold text-slate-900">
            SpeakEasy
          </Link>
          <Link href="/docs/" className="text-sm text-slate-600 hover:text-slate-900">
            Documentation
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-blue-700">
          Last updated {updated}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{summary}</p>

        <div className="mt-12 space-y-10 text-base leading-7 text-slate-700 [&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </main>
  )
}
