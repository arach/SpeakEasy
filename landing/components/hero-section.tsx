"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Volume2, Github, BookOpen, ExternalLink, Play, Pause, Copy, Check, Star } from "lucide-react"
import Link from "next/link"
import PackageManagerTabs from "@/components/package-manager-tabs"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import GitHubRibbon from "@/components/github-ribbon"

function TinyAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const cliCommand = `speakeasy "Welcome to SpeakEasy! This unified text-to-speech service makes it easy to add voice to your applications" --provider openai --voice nova --rate 180`

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

  const copyCommand = async () => {
    await navigator.clipboard.writeText(cliCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Show Example Command Button */}
      <Button
        onClick={() => setShowDemo(!showDemo)}
        className="h-10 px-6 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-full font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
      >
        <Play className="w-4 h-4 mr-2" />
        {showDemo ? 'Hide Example' : 'Show Example Command'}
      </Button>

      {/* Animated Demo Container */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
        showDemo 
          ? 'max-h-96 opacity-100 transform translate-y-0' 
          : 'max-h-0 opacity-0 transform -translate-y-4'
      }`}>
        <div className="flex flex-col items-center gap-3 pt-2">
          {/* Primary CTA - Command Display */}
          <div className="w-full max-w-md">
            <div className="relative bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCommand}
                className="absolute top-2 right-2 text-slate-400 hover:text-white hover:bg-slate-700 h-6 w-6 p-0 rounded-md z-10"
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
              <SyntaxHighlighter
                language="bash"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '12px 16px',
                  background: 'transparent',
                  fontSize: '0.75rem',
                  lineHeight: '1.4',
                  fontWeight: '300',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
                codeTagProps={{
                  style: {
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontWeight: '300',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }
                }}
                wrapLines={true}
                wrapLongLines={true}
              >
                {cliCommand}
              </SyntaxHighlighter>
            </div>
          </div>
          
          {/* Secondary CTA - Play Result */}
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
              Play Result
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeroSection() {
  const [showHeader, setShowHeader] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      // Show header after scrolling down 100px on mobile
      setShowHeader(scrollY > 100)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Navigation Header */}
      <nav className={`fixed top-0 left-0 right-0 z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm transition-transform duration-300 ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="font-silkscreen text-slate-900 text-lg">SpeakEasy</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/docs/overview">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 text-xs">
                  <BookOpen className="w-3 h-3 mr-1" />
                  Docs
                </Button>
              </Link>
              <Link 
                href="https://www.npmjs.com/package/@arach/speakeasy" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 text-xs">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 27.23 27.23">
                    <rect width="27.23" height="27.23" rx="2"/>
                    <polygon fill="#fff" points="5.8 21.75 13.66 21.75 13.67 9.98 17.59 9.98 17.58 21.76 21.51 21.76 21.52 6.06 5.82 6.04 5.8 21.75"/>
                  </svg>
                  NPM
                </Button>
              </Link>
              <GitHubRibbon />
            </div>
          </div>
        </div>
      </nav>


      <section className="relative py-6 md:py-12 flex items-center justify-center px-4 overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.03),transparent_50%)]" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl mb-2 md:mb-3 text-slate-900 leading-[0.9] tracking-tight">
          <span className="font-silkscreen">SpeakEasy</span>
          <br />
          <span className="font-display font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Unified TTS
          </span>
        </h1>

        <p className="font-text text-sm sm:text-base md:text-lg text-slate-600 mb-3 md:mb-4 max-w-2xl mx-auto leading-relaxed font-light px-4">
          Simple text-to-speech for all your projects. Multiple providers, smart caching, and volume control.
        </p>

        {/* Demo Command & Audio Player */}
        <div className="mb-4 md:mb-6 flex justify-center">
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
