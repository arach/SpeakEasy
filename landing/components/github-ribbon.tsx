"use client"

import { Github, Star } from "lucide-react"

export default function GitHubRibbon() {
  return (
    <a
        href="https://github.com/arach/SpeakEasy"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-1 md:gap-2 bg-slate-900 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-full shadow-lg hover:bg-slate-800 transition-all duration-200 hover:scale-105"
      >
        <Github className="w-3 h-3 md:w-4 md:h-4" />
        <div className="flex items-center gap-0.5 md:gap-1">
          <Star className="w-2.5 h-2.5 md:w-3 md:h-3 fill-current" />
          <span className="text-xs md:text-sm font-medium">Star</span>
        </div>
      </a>
  )
}