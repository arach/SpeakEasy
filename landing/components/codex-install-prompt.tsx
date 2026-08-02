"use client"

import { useState } from "react"
import { Check, Clipboard, ExternalLink, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { codexInstallPrompt, releaseInstallerUrl, releaseVersion } from "@/lib/release"

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
    <section id="codex-install" className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(52,211,153,0.16),transparent_36%)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" /> Recommended
            </div>
            <h3 className="mt-3 font-display text-2xl font-medium">Hand the install to Codex.</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
              Codex can do the download, verification, replacement, and launch. You only handle the macOS permission prompts that require a person.
            </p>
          </div>
          <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] text-emerald-300 sm:block">
            v{releaseVersion}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 font-mono text-xs leading-6 text-white/68">
          {codexInstallPrompt}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={copyPrompt} className="rounded-xl bg-emerald-300 font-semibold text-slate-950 hover:bg-emerald-200">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy prompt for Codex"}
          </Button>
          <a href={releaseInstallerUrl} className="inline-flex items-center justify-center gap-1.5 text-xs text-white/45 transition hover:text-white">
            Inspect the installer yourself <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-white/35">
          No curl-to-shell shortcut: Codex is asked to inspect the script first. The installer fails closed before changing Applications if any release check disagrees.
        </p>
      </div>
    </section>
  )
}
