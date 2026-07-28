"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BookOpen, Download, Pause, Play, Volume2 } from "lucide-react"
import GitHubRibbon from "@/components/github-ribbon"
import ReleaseStatusStrip from "@/components/listening/release-status-strip"
import { Button } from "@/components/ui/button"

function AgentAudioButton() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const toggle = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      return
    }

    try {
      await audioRef.current.play()
    } catch {
      setHasError(true)
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src="/audio/permission.mp3"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => setHasError(true)}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={toggle}
        disabled={hasError}
        className="h-12 rounded-xl border-slate-300 bg-white px-6 text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/40 disabled:text-slate-400"
      >
        {hasError ? (
          <Volume2 className="mr-2 h-4 w-4" />
        ) : isPlaying ? (
          <Pause className="mr-2 h-4 w-4" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {hasError ? "Audio unavailable" : isPlaying ? "Playing permission request" : "Hear an agent ask for permission"}
      </Button>
    </>
  )
}

export default function HeroSection() {
  const [showHeader, setShowHeader] = useState(false)

  useEffect(() => {
    const handleScroll = () => setShowHeader(window.scrollY > 100)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed inset-x-0 top-0 z-20 border-b border-slate-200/60 bg-white/85 backdrop-blur-md transition-transform duration-300 ${
          showHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-silkscreen text-lg text-slate-900">SpeakEasy</span>
          <div className="flex items-center gap-3">
            <Link href="/docs/quickstart/">
              <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900">
                <BookOpen className="mr-1 h-3 w-3" /> Docs
              </Button>
            </Link>
            <GitHubRibbon />
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-4 pb-20 pt-16 md:pb-28 md:pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.11),transparent_42%)]" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_70%,rgba(59,130,246,0.05),transparent_38%)]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-700 shadow-sm">
            SpeakEasy · Unified Speech
          </div>
          <h1 className="font-display text-5xl font-extralight leading-[0.95] tracking-tight text-slate-950 sm:text-6xl md:text-7xl lg:text-8xl">
            Have a natural conversation with your coding agent
          </h1>
          <p className="mx-auto mt-7 max-w-3xl font-text text-lg font-light leading-relaxed text-slate-600 md:text-xl">
            One speech layer for your agents, tools, and applications: multi-provider TTS out today; explicit mic
            capture and local ASR back to one exact Codex task in the Mac listening preview. Hear your work so you can
            leave the window.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-slate-950 px-7 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800"
            >
              <a href="https://github.com/arach/SpeakEasy/releases/latest/download/SpeakEasy.dmg">
                <Download className="mr-2 h-4 w-4" /> Download
              </a>
            </Button>
            <AgentAudioButton />
          </div>

          <p className="mt-4 text-xs text-slate-500">Signed and notarized for macOS 14+</p>
          <ReleaseStatusStrip variant="hero" className="mt-8" />
        </div>
      </section>
    </>
  )
}
