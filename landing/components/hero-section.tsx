"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Volume2, Github } from "lucide-react"
import PackageManagerTabs from "@/components/package-manager-tabs"

export default function HeroSection() {
  return (
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

        <div className="flex flex-col items-center">
          <PackageManagerTabs />
        </div>
      </div>
    </section>
  )
}
