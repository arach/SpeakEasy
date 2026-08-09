"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ExternalLink, Star } from "lucide-react"
import { Volume2, BookOpen, Play, Pause, Copy, Check } from "./icons"
import Link from "next/link"
import PackageManagerTabs from "@/components/package-manager-tabs"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import GitHubRibbon from "@/components/github-ribbon"

function HeroAudioPlayer({ onPlayingChange }: { onPlayingChange?: (playing: boolean) => void }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        try {
          await audioRef.current.play()
        } catch (error) {
          console.error('Audio playback failed:', error)
          setHasError(true)
        }
      }
      setIsPlaying(!isPlaying)
    }
  }

  useEffect(() => {
    onPlayingChange?.(isPlaying)
  }, [isPlaying, onPlayingChange])

  return (
    <div className="flex items-center gap-2 relative">
      <audio 
        ref={audioRef}
        src="/audio/tagline-demo.mp3"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => setHasError(true)}
      />
      
      
      <Button
        onClick={togglePlay}
        size="sm"
        disabled={hasError}
        className={`relative z-10 h-8 px-3 text-sm font-medium rounded-full transition-all duration-200 ${
          hasError 
            ? 'bg-slate-400 cursor-not-allowed text-white' 
            : isPlaying 
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
              : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105'
        }`}
      >
        {hasError ? (
          <>
            <Volume2 className="w-3 h-3 mr-1.5" />
            Audio Unavailable
          </>
        ) : isPlaying ? (
          <>
            <Pause className="w-3 h-3 mr-1.5" />
            Playing
          </>
        ) : (
          <>
            <Play className="w-3 h-3 mr-1.5" />
            Play Demo
          </>
        )}
      </Button>
    </div>
  )
}

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
      {/* Quiet by design: this sits in the secondary library block, so it must not
          outweigh the two primary app CTAs above the rule. */}
      <Button
        variant="outline"
        onClick={() => setShowDemo(!showDemo)}
        className="h-9 rounded-full border border-slate-300 bg-white/70 px-5 text-xs font-medium text-slate-600 shadow-none transition-all duration-200 hover:border-slate-400 hover:bg-white hover:text-slate-900"
      >
        <Volume2 className="w-3.5 h-3.5 mr-2" />
        {showDemo ? 'Hide sample' : 'Hear a sample'}
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
              className={`h-8 px-4 text-sm font-medium bg-gradient-to-r from-emerald-50 to-blue-50 hover:from-emerald-100 hover:to-blue-100 border-2 border-emerald-300 text-emerald-700 hover:text-emerald-800 rounded-full shadow-md hover:shadow-lg transition-all duration-200 ${isPlaying ? 'animate-pulse border-emerald-500' : ''}`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  <span className="flex items-center gap-1">
                    Playing Audio
                    <div className="flex gap-0.5">
                      <div className="w-1 h-3 bg-emerald-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-1 h-3 bg-emerald-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-1 h-3 bg-emerald-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  🎧 Play Audio Result
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeroSection() {
  const [showHeader, setShowHeader] = useState(false)
  const [isHeroPlaying, setIsHeroPlaying] = useState(false)

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
              <Link href="/codex/">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 text-xs">
                  Codex
                </Button>
              </Link>
              <Link href="/docs/quickstart/">
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
            Unified text-to-speech
          </span>
        </h1>

        <div className="font-text text-sm sm:text-base md:text-lg mb-3 md:mb-4 max-w-4xl mx-auto leading-relaxed font-light px-4">
          <div className="text-center">
            {/* First line: say("tagline") */}
            <div className="flex items-baseline justify-center">
              {/* Code prefix */}
              <span className={`font-mono text-emerald-600 font-medium tracking-tight transition-opacity duration-300 ${
                isHeroPlaying ? 'opacity-100' : 'opacity-0'
              }`}>
                say("
              </span>
              {/* Main tagline text */}
              <span className="text-slate-700 font-light">
                One API for macOS, OpenAI, ElevenLabs, Groq, and Gemini voices.
              </span>
              {/* Close quote */}
              <span className={`font-mono text-emerald-600 font-medium tracking-tight transition-opacity duration-300 ${
                isHeroPlaying ? 'opacity-100' : 'opacity-0'
              }`}>
                ",
              </span>
            </div>
            
            {/* Second line: parameters */}
            <div className="flex justify-center mt-1">
              <span className={`font-mono text-emerald-600 font-medium tracking-tight text-sm transition-opacity duration-300 ${
                isHeroPlaying ? 'opacity-100' : 'opacity-0'
              }`}>
                &#123;&nbsp;mode:&nbsp;'speak',&nbsp;task:&nbsp;'locked'&nbsp;&#125;)
              </span>
            </div>
          </div>
        </div>

        {/* Always Visible Mini Audio Demo */}
        <div className="mb-5 flex justify-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-full border border-emerald-200/50 shadow-sm hover:shadow-md transition-all duration-200 px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center text-sm text-slate-600">
                <Volume2 className="w-4 h-4 mr-2 text-emerald-600" />
                Hear it speak:
              </div>
              <HeroAudioPlayer onPlayingChange={setIsHeroPlaying} />
            </div>
          </div>
        </div>

        {/* Primary — SpeakEasy is a unified TTS library first. Installing it is the
            action for the audience that actually exists today. */}
        <div className="flex flex-col items-center">
          <PackageManagerTabs />
          <div className="mt-4 flex justify-center">
            <TinyAudioPlayer />
          </div>
        </div>

        {/* The Codex companion is the flagship use case, announced here and sold in
            full on its own page rather than competing with the library in this hero. */}
        <Link
          href="/codex/"
          className="group mt-8 flex w-full max-w-2xl flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-4 text-center shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-emerald-300/70 hover:shadow-md sm:flex-row sm:gap-4 sm:text-left"
        >
          <Badge
            variant="outline"
            className="shrink-0 rounded-lg border-emerald-300/60 bg-emerald-50 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"
          >
            New
          </Badge>
          <span className="flex-1">
            <span className="block text-sm font-medium text-slate-900">
              Introducing SpeakEasy for Codex
            </span>
            <span className="mt-0.5 block text-xs font-light leading-relaxed text-slate-500">
              Speak to the task you’re already in, and hear its real answer come back — on your Mac, a browser, or an iPad.
            </span>
          </span>
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-600 sm:block" />
        </Link>
      </div>
    </section>
    </>
  )
}
