"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

const steps = [
  {
    number: "1",
    command: "npm install -g @arach/speakeasy",
    output: "+ @arach/speakeasy@0.2.6\nAdded 1 package in 2.3s",
  },
  {
    number: "2",
    command: "speakeasy --set-key elevenlabs sk_abc123...",
    output: "✅ ElevenLabs API key saved to config\n\n🎉 You can now use:\n   speakeasy \"Hello world\" --provider elevenlabs",
  },
  {
    number: "3",
    command: 'speakeasy "Hello world!" --provider elevenlabs',
    output: "🎙️ Speaking with elevenlabs...",
  }
]

export default function QuickStartSection() {
  const [copiedStep, setCopiedStep] = useState<string | null>(null)

  const copyToClipboard = async (command: string, step: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedStep(step)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-extralight mb-2 text-slate-900">
            Get Started in
            <span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> 3 Steps</span>
          </h2>
        </div>

        {/* Terminal card */}
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl">
          {/* Terminal header */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 border-b border-slate-700">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>

          {/* Commands */}
          <div className="p-4 space-y-4 font-mono text-sm">
            {steps.map((step) => (
              <div key={step.number} className="group">
                {/* Command line */}
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 select-none">❯</span>
                  <span className="text-slate-300 flex-1">{step.command}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(step.command, step.number)}
                    className="text-slate-600 hover:text-white hover:bg-slate-700 h-6 w-6 p-0 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedStep === step.number ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                {/* Output */}
                <div className="ml-4 mt-1 text-slate-500 text-xs whitespace-pre-line">
                  {step.output}
                </div>
              </div>
            ))}
          </div>

          {/* Hint */}
          <div className="px-4 pb-3 text-xs text-slate-600">
            <span className="opacity-70">No API key? Use </span>
            <code className="text-slate-500">--provider system</code>
            <span className="opacity-70"> for built-in macOS voices</span>
          </div>
        </div>

        {/* API Key Links */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
          <span className="text-slate-500">Get API keys:</span>
          <a
            href="https://elevenlabs.io/app/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            ElevenLabs
          </a>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 hover:underline"
          >
            OpenAI
          </a>
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-700 hover:underline"
          >
            Groq
          </a>
          <a
            href="https://makersuite.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 hover:underline"
          >
            Gemini
          </a>
        </div>
      </div>
    </section>
  )
}
