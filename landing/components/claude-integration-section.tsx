"use client"

import { useState } from "react"
import { Bell, ChevronLeft, ChevronRight, Clock, MessageSquare } from "lucide-react"
import AudioWaveformPlayer from "@/components/audio-waveform-player"
import TerminalInterface from "@/components/terminal-interface"
import { Badge } from "@/components/ui/badge"

const notificationExamples = [
  {
    trigger: "Claude needs your permission",
    spoken: "In SpeakEasy, Claude needs your permission",
    audioFile: "/audio/permission.mp3",
    icon: MessageSquare,
    color: "text-blue-600",
    hookType: "Permission request",
    terminalType: "permission" as const,
  },
  {
    trigger: "Claude is waiting for your input",
    spoken: "In SpeakEasy, Claude is waiting for your input",
    audioFile: "/audio/waiting-input.mp3",
    icon: Bell,
    color: "text-amber-600",
    hookType: "Input needed",
    terminalType: "input" as const,
  },
  {
    trigger: "Claude is waiting for you",
    spoken: "In SpeakEasy, Claude is waiting for you",
    audioFile: "/audio/waiting-for-you.mp3",
    icon: Clock,
    color: "text-slate-600",
    hookType: "Agent waiting",
    terminalType: "waiting" as const,
  },
] as const

export default function ClaudeIntegrationSection() {
  const [currentExample, setCurrentExample] = useState(0)
  const example = notificationExamples[currentExample]
  const CurrentIcon = example.icon

  const move = (delta: number) => {
    setCurrentExample((current) => (current + delta + notificationExamples.length) % notificationExamples.length)
  }

  return (
    <section className="relative bg-gradient-to-br from-blue-50/40 to-slate-50/70 px-4 py-20 md:py-24">
      <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-slate-900/5 to-transparent" aria-hidden="true" />
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-5 rounded-xl border-slate-200 bg-white/70 text-slate-600">
            Agent loop · flagship proof
          </Badge>
          <h2 className="font-display text-4xl font-extralight text-slate-950 md:text-6xl">
            Your agent tells you when it needs you
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg font-light leading-relaxed text-slate-600">
            Codex, Claude Code, and shell hooks can send their updates to one Mac player. Hear the work without
            watching the window; when an integration supplies originating task context, SpeakEasy keeps it attached.
          </p>
        </div>

        <div className="rounded-3xl border border-white bg-white/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-8">
          <div className="grid gap-7 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5">
                  <CurrentIcon className={`h-5 w-5 ${example.color}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{example.hookType}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Claude Code example</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">What the agent shows</p>
                <p className="font-mono text-xs text-slate-700">{example.trigger}</p>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">What you hear</p>
                <p className="mb-3 text-sm text-slate-700">“{example.spoken}”</p>
                <AudioWaveformPlayer audioUrl={example.audioFile} className="w-full shadow-md" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">The loop you already run</p>
              <TerminalInterface className="w-full" notificationType={example.terminalType} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous agent example"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-colors hover:text-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-2" aria-label="Agent examples">
            {notificationExamples.map((item, index) => (
              <button
                key={item.hookType}
                type="button"
                onClick={() => setCurrentExample(index)}
                aria-label={`Show ${item.hookType}`}
                aria-current={index === currentExample ? "true" : undefined}
                className={`h-2 rounded-full transition-all ${index === currentExample ? "w-6 bg-blue-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next agent example"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-colors hover:text-slate-900"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
          Claude Code is one concrete integration, not the boundary: any agent or tool that can call the CLI can use
          the same speech path. The Codex plugin adds a near-native path into the player without a separate workflow.
        </p>
      </div>
    </section>
  )
}
