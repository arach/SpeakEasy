"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, Copy, ExternalLink, MonitorSpeaker, Terminal } from "lucide-react"
import { releaseVersion } from "@/lib/release"

const agentPrompt = `Read https://speakeasy.arach.dev/agent.md and follow it.`
const codexPrompt = `Install SpeakEasy ${releaseVersion} on this Mac. Read https://speakeasy.arach.dev/agent.md and follow Path A. Do not build from source or bypass Gatekeeper. Tell me which human-only steps remain.`

function CopyPrompt({
  payload,
  label,
  accent,
}: {
  payload: string
  label: string
  accent: "emerald" | "teal"
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      // Clipboard API can reject (permissions policy, headless) — fall back.
      const ta = document.createElement("textarea")
      ta.value = payload
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 12000)
  }

  const isEmerald = accent === "emerald"

  return (
    <div className="mt-auto">
      {!copied ? (
        <Button
          onClick={copy}
          variant="outline"
          className={`w-full rounded-xl border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ${
            isEmerald
              ? "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              : "hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
          }`}
        >
          <Copy className="w-4 h-4 mr-2" />
          {label}
        </Button>
      ) : (
        <div className="relative bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-400">
              Copied — paste it into your agent
            </span>
            <Check className={`w-3.5 h-3.5 ${isEmerald ? "text-emerald-400" : "text-teal-400"}`} />
          </div>
          <p className="text-sm text-slate-100 leading-relaxed p-4 font-light font-mono break-words">
            {payload}
          </p>
        </div>
      )}
    </div>
  )
}

export default function AgentVoiceSection() {
  return (
    <section className="relative">
      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-slate-900/5 to-transparent pointer-events-none" />

      <div className="py-16 px-4 bg-gradient-to-br from-emerald-50/40 to-slate-50/60">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-slate-200 text-slate-600 bg-white/50 rounded-xl hidden sm:inline-block">
              Agent workflows
            </Badge>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extralight mb-4 text-slate-900">
              Tell your agent to speak.{" "}
              <span className="font-light bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                That's the whole setup.
              </span>
            </h2>
            <p className="font-text text-lg text-slate-600 max-w-2xl mx-auto font-light">
              You don't wire anything up — your coding agent does. The current signed preview proves the Mac loop; paired browser and iPad setup joins the signed 0.2.19 candidate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: any coding agent — how it works */}
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 p-6 sm:p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
                  <Terminal className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Any coding agent</h3>
              </div>

              <p className="text-sm text-slate-600 font-light leading-relaxed mb-4">
                Three moving parts, all plain files and one npm package:
              </p>
              <ul className="space-y-2.5 text-sm text-slate-600 font-light mb-6">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-none mt-1.5" />
                  <span>
                    <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">agent.md</code> — the
                    runbook your agent reads and executes.{" "}
                    <a
                      href="https://speakeasy.arach.dev/agent.md"
                      className="text-emerald-600 hover:text-emerald-500 underline underline-offset-2"
                    >
                      Read it yourself
                    </a>{" "}
                    — it's one short page.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-none mt-1.5" />
                  <span>
                    <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">@arach/speakeasy</code> — the
                    npm CLI that generates and plays speech. Zero keys via the macOS system voice.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-none mt-1.5" />
                  <span>
                    <code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">speakeasy deck</code> — serves
                    the control surface on your network and prints a QR code for your iPad.
                  </span>
                </li>
              </ul>

              <p className="text-sm text-slate-600 font-light leading-relaxed mb-3">
                What your agent will do, in order:
              </p>
              <ol className="space-y-2 text-sm text-slate-600 font-light mb-6 list-none">
                {[
                  "npx @arach/speakeasy — nothing installed into your project",
                  "A silent audio check — you hear nothing until it works",
                  "A one-sentence spoken summary each time it finishes a task",
                  "speakeasy deck, only when you ask for the iPad remote",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-none w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-mono flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <CopyPrompt payload={agentPrompt} label="Copy prompt for your agent" accent="emerald" />
            </div>

            {/* Right: the complete Codex voice loop */}
            <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 p-6 sm:p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-teal-50 to-teal-100">
                  <MonitorSpeaker className="w-5 h-5 text-teal-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Codex — the complete voice loop</h3>
              </div>

              <p className="text-sm text-slate-600 font-light leading-relaxed mb-4">
                For Codex on macOS 14+, SpeakEasy ships as one signed native app: local dictation goes into
                an exact task and that task&apos;s real response returns through the player. The install is itself
                a transparent Codex task:
              </p>

              <ol className="space-y-3 text-sm text-slate-600 font-light mb-6 list-none">
                <li className="flex items-start gap-2.5">
                  <span className="flex-none w-4 h-4 rounded-full bg-teal-100 text-teal-700 text-[10px] font-mono flex items-center justify-center mt-0.5">
                    1
                  </span>
                  <div className="min-w-0">
                    <span>Codex reads the public runbook and inspects the pinned installer before running it:</span>
                    <code className="block text-[11px] font-mono bg-slate-900 text-teal-300 rounded-lg px-3 py-2 mt-1.5 whitespace-pre-wrap break-all">
                      agent.md · Path A · v0.2.18
                    </code>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-none w-4 h-4 rounded-full bg-teal-100 text-teal-700 text-[10px] font-mono flex items-center justify-center mt-0.5">
                    2
                  </span>
                  <span>Checksum, Gatekeeper, Developer ID, and exact version must all pass before Applications changes.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-none w-4 h-4 rounded-full bg-teal-100 text-teal-700 text-[10px] font-mono flex items-center justify-center mt-0.5">
                    3
                  </span>
                  <span>
                    SpeakEasy opens its guided Deck setup. You approve the microphone and local-network prompts; Codex reports what remains.
                  </span>
                </li>
              </ol>

              <CopyPrompt payload={codexPrompt} label="Copy prompt for Codex" accent="teal" />

              <div className="mt-4">
                <a
                  href="https://github.com/arach/SpeakEasy/blob/master/app/tools/release/install-release.sh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-600 transition-colors"
                >
                  Inspect the release installer on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
