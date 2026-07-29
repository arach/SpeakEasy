import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, GitBranch, Layers3, MessageCircleMore, Route } from "lucide-react"
import SiteFooter from "@/components/site-footer"
import SiteNav from "@/components/site-nav"

export const metadata: Metadata = {
  title: "Codex visual concepts · SpeakEasy",
  description: "Two independent visual studies for the SpeakEasy and Codex conversation loop.",
}

const studies = [
  {
    name: "Kimi",
    href: "/codex/concepts/kimi/",
    eyebrow: "Independent study 01",
    accent: "from-emerald-500 to-cyan-500",
    wash: "from-emerald-50 via-white to-cyan-50",
    border: "hover:border-emerald-300",
    description: "Three visual variations on deliberate voice, durable task identity, and one continuous Codex conversation.",
    variants: ["Addressed Wave", "Hinged Modes", "Glass Player"],
  },
  {
    name: "Grok",
    href: "/codex/concepts/grok/",
    eyebrow: "Independent study 02",
    accent: "from-blue-500 to-violet-500",
    wash: "from-blue-50 via-white to-violet-50",
    border: "hover:border-blue-300",
    description: "Three visual variations on the same brief, developed separately to reveal a different storytelling instinct.",
    variants: ["Nine Lanes", "Thread with a Seal", "Menu-Bar Instrument"],
  },
]

export default function CodexConceptsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 text-slate-900">
      <SiteNav />

      <section className="relative border-b border-slate-200/70 px-4 py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(16,185,129,0.09),transparent_28%),radial-gradient(circle_at_82%_68%,rgba(59,130,246,0.08),transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl">
          <Link href="/codex/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to SpeakEasy for Codex
          </Link>

          <div className="mt-14 grid items-end gap-10 lg:grid-cols-[1.1fr_0.65fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Same brief · two points of view</div>
              <h1 className="mt-5 max-w-4xl font-display text-5xl font-extralight leading-[0.98] tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
                Two ways to make an exact conversation
                <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text font-light text-transparent"> visible.</span>
              </h1>
            </div>
            <p className="max-w-xl font-text text-base font-light leading-7 text-slate-600 lg:pb-1">
              Kimi and Grok received the same product truth and worked independently. Each study now opens with source-rendered captures of the real native app, then applies a different visual point of view across three directions.
            </p>
          </div>

          <div className="mt-14 grid gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-xl sm:grid-cols-3 sm:p-5">
            {[
              [MessageCircleMore, "Real app first", "Source-rendered player, lanes, and HUD"],
              [Route, "Exact-task routing", "The chosen task ID stays attached"],
              [Layers3, "Three variations each", "Six complete directions to compare"],
            ].map(([Icon, title, body]) => {
              const StudyIcon = Icon as typeof MessageCircleMore
              return (
                <div key={String(title)} className="flex gap-3 rounded-xl px-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><StudyIcon className="h-4 w-4" /></span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{String(title)}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{String(body)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-2">
          {studies.map((study, index) => (
            <Link
              key={study.name}
              href={study.href}
              className={`group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br ${study.wash} p-7 shadow-xl shadow-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${study.border} sm:p-9`}
            >
              <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br ${study.accent} opacity-[0.09] blur-2xl transition duration-500 group-hover:scale-125 group-hover:opacity-[0.14]`} />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{study.eyebrow}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-white/80 text-slate-600 shadow-sm transition group-hover:translate-x-0.5 group-hover:text-slate-950">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-20 flex items-end justify-between gap-5 sm:mt-28">
                  <div>
                    <div className={`mb-5 h-1 w-14 rounded-full bg-gradient-to-r ${study.accent}`} />
                    <h2 className="font-display text-5xl font-light tracking-tight text-slate-900">{study.name}</h2>
                    <p className="mt-4 max-w-md text-sm font-light leading-6 text-slate-600">{study.description}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {study.variants.map((variant) => (
                        <span key={variant} className="rounded-full border border-white/90 bg-white/70 px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                          {variant}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="font-mono text-3xl font-light text-slate-300">0{index + 1}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><GitBranch className="h-3 w-3" /> 3 branches</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mx-auto mt-9 max-w-2xl text-center text-xs leading-5 text-slate-500">
          Concept studies are exploratory. Product availability and technical-preview boundaries remain the same across every variation.
        </p>
      </section>

      <SiteFooter />
    </main>
  )
}
