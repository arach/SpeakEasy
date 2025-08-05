"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Volume2, Github, BookOpen, ExternalLink, Play, Pause } from "lucide-react"
import Link from "next/link"
import PackageManagerTabs from "@/components/package-manager-tabs"

function TinyAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showCLI, setShowCLI] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleDemoClick = () => {
    setShowCLI(!showCLI)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <audio 
          ref={audioRef}
          src="/audio/welcome-demo.mp3"
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          className="h-7 px-3 text-xs bg-white/80 hover:bg-white border-emerald-200 text-emerald-700 hover:text-emerald-800 rounded-full"
        >
          {isPlaying ? (
            <Pause className="w-3 h-3 mr-1.5" />
          ) : (
            <Play className="w-3 h-3 mr-1.5" />
          )}
          Demo
        </Button>
        <button 
          onClick={handleDemoClick}
          className="text-xs text-slate-500 hover:text-slate-700 underline decoration-dotted cursor-pointer"
        >
          OpenAI Nova
        </button>
      </div>
      {showCLI && (
        <div className="mt-2 p-3 bg-slate-900 rounded-lg text-xs text-green-400 font-mono max-w-sm">
          <div className="text-slate-400 mb-1">$ Generated with:</div>
          <div>speakeasy "Welcome to SpeakEasy" --provider openai --voice nova --rate 180</div>
        </div>
      )}
    </div>
  )
}

export default function HeroSection() {
  return (
    <>
      {/* Navigation Header */}
      <nav className="relative z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-6 h-6 text-emerald-600" />
              <span className="font-display font-semibold text-slate-900">SpeakEasy</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/docs/overview">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Documentation
                </Button>
              </Link>
              <Link 
                href="https://github.com/arach/SpeakEasy" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <Github className="w-4 h-4 mr-2" />
                  GitHub
                </Button>
              </Link>
              <Link 
                href="https://www.npmjs.com/package/@arach/speakeasy" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  NPM
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative py-12 md:py-16 flex items-center justify-center px-4 overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.03),transparent_50%)]" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
        <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50/50 backdrop-blur-sm rounded-xl">
          <Volume2 className="w-3 h-3 mr-2" />
          Open Source • v0.2.0
        </Badge>

        <h1 className="font-display text-5xl md:text-6xl font-extralight mb-3 text-slate-900 leading-[0.9] tracking-tight">
          SpeakEasy
          <br />
          <span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Unified TTS
          </span>
        </h1>

        <p className="font-text text-sm sm:text-base md:text-lg text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed font-light px-4">
          Simple text-to-speech for all your projects. Multiple providers, smart caching, and volume control.
        </p>

        {/* Tiny Demo Audio Player */}
        <div className="mb-6 flex justify-center">
          <TinyAudioPlayer />
        </div>


        <div className="flex flex-col items-center">
          <PackageManagerTabs />
        </div>
      </div>
    </section>
    </>
  )
}
