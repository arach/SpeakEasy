"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import ReadinessStrip from "./components/readiness-strip"
import VariationWave from "./components/variation-wave"
import VariationHinge from "./components/variation-hinge"
import VariationGlass from "./components/variation-glass"

export const variations = [
  {
    id: "wave",
    number: "01",
    name: "Addressed Wave",
    premise:
      "A waveform only becomes useful when it is addressed to one exact Codex task—like a letter that carries its destination inside the envelope.",
  },
  {
    id: "hinge",
    number: "02",
    name: "Hinged Modes",
    premise:
      "Listen and Speak are two halves of one card, hinged on the persistent task identity that Codex owns and continues.",
  },
  {
    id: "glass",
    number: "03",
    name: "Glass Player",
    premise:
      "The native menu-bar player is the visible proof: the real Codex response, queued, controlled, and traced back to its originating task.",
  },
] as const

export type VariationId = (typeof variations)[number]["id"]

function StudyChrome() {
  const [active, setActive] = useState<VariationId>("wave")

  useEffect(() => {
    const sections = variations
      .map((v) => document.getElementById(v.id))
      .filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) {
          setActive(visible.target.id as VariationId)
        }
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.12, 0.32, 0.52] }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/codex/"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Codex
            </Link>
            <div className="hidden h-4 w-px bg-slate-200 sm:block" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Visual study · Kimi
              </p>
              <p className="truncate text-sm font-medium text-slate-900">
                SpeakEasy × Codex · three directions
              </p>
            </div>
          </div>
          <p className="max-w-sm text-right text-[11px] leading-4 text-slate-500">
            Independent concept work. Not the production Codex page.
          </p>
        </div>

        <nav aria-label="Concept variations" className="flex gap-2 overflow-x-auto pb-0.5">
          {variations.map((v) => {
            const isActive = active === v.id
            return (
              <a
                key={v.id}
                href={`#${v.id}`}
                onClick={() => setActive(v.id)}
                className={`group flex min-w-[9.5rem] flex-1 items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition motion-reduce:transition-none ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`font-mono text-[10px] font-semibold tracking-wider ${
                    isActive ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {v.number}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-4">{v.name}</span>
                  <span
                    className={`mt-0.5 line-clamp-2 block text-[10px] leading-3.5 ${
                      isActive ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {v.premise}
                  </span>
                </span>
              </a>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default function KimiConceptStudy() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <StudyChrome />

      <div className="border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Kimi · independent visual concepts
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extralight leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
            Three ways to make the same Codex loop felt.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-light leading-7 text-slate-600 sm:text-lg">
            Same product truth—deliberate listen, exact-task route, real Codex conversation,
            native speak—rendered as three distinct visual instincts for review.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {variations.map((v) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 motion-reduce:transition-none"
              >
                <span className="font-mono text-slate-400">{v.number}</span> {v.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <VariationWave />
      <VariationHinge />
      <VariationGlass />

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-900">Kimi concept study complete</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Route{" "}
              <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
                /codex/concepts/kimi/
              </code>
              . Independent of the production Codex page and of Grok’s concepts.
            </p>
          </div>
          <Link
            href="/codex/"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 motion-reduce:transition-none"
          >
            Return to Codex
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </footer>
    </main>
  )
}
