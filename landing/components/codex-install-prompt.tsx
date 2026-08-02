"use client"

import { useState } from "react"
import { Check, Clipboard, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { codexInstallPrompt, releaseInstallerUrl, releaseVersion } from "@/lib/release"

const codexWork = ["Download", "Inspect", "Trust checks", "Replace", "Setup", "Launch"]
const humanWork = ["Microphone", "Local network"]

export default function CodexInstallPrompt() {
  const [copied, setCopied] = useState(false)

  async function copyPrompt() {
    setCopied(true)
    try {
      await navigator.clipboard.writeText(codexInstallPrompt)
    } catch {
      const textArea = document.createElement("textarea")
      textArea.value = codexInstallPrompt
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      textArea.remove()
    }
    window.setTimeout(() => setCopied(false), 2200)
  }

  return (
    <section id="codex-install" className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5">
      <header className="border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Codex install</span>
          <span className="font-mono text-[10px] text-slate-400">v{releaseVersion}</span>
        </div>
        <h3 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">Paste once.</h3>
        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-500">
          Codex downloads the pinned installer, inspects it, verifies every trust boundary, replaces the app safely, finishes setup, and launches SpeakEasy.
        </p>
      </header>

      <div className="grid gap-3 border-b border-slate-100 px-5 py-5 sm:grid-cols-[1.15fr_0.85fr] sm:px-7">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Codex handles</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {codexWork.map((label) => (
              <span key={label} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 border-l-2 border-l-emerald-600 bg-emerald-50/40 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">You handle</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {humanWork.map((label) => (
              <span key={label} className="rounded-md border border-emerald-200/80 bg-white px-2 py-1 text-[11px] font-medium text-emerald-900">
                {label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Only macOS can grant these permissions.</p>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-shadow duration-200 ${copied ? "ring-1 ring-emerald-600/25" : ""}`}>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Install task</span>
            <span className="text-[11px] text-slate-400">Paste into a new Codex task</span>
          </div>
          <p className="mt-3 line-clamp-3 font-mono text-[11px] leading-5 text-slate-500">{codexInstallPrompt}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={copyPrompt}
              className="rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/20"
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy for Codex"}
            </Button>
            <a href={releaseInstallerUrl} className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-900">
              Inspect installer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <span className="sr-only" aria-live="polite">{copied ? "Install task copied" : ""}</span>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-slate-400">
          Codex is instructed to inspect before running. The installer fails closed if any release check disagrees.
        </p>
      </div>
    </section>
  )
}
