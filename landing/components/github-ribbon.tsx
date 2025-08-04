"use client"

import { Github, Star } from "lucide-react"

export default function GitHubRibbon() {
  return (
    <div className="fixed top-4 right-4 z-50">
      <a
        href="https://github.com/arach/SpeakEasy"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-full shadow-lg hover:bg-slate-800 transition-all duration-200 hover:scale-105"
      >
        <Github className="w-4 h-4" />
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" />
          <span className="text-sm font-medium">Star</span>
        </div>
      </a>
    </div>
  )
}