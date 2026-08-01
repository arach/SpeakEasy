'use client'

import Link from 'next/link'
import { ArrowLeft, Zap, Volume2, Waves, Monitor, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.03),transparent_50%)]" />

      {/* Header */}
      <header className="border-b border-slate-200/50 backdrop-blur-sm bg-white/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <span className="font-silkscreen text-slate-900 text-lg">SpeakEasy</span>
          <div className="w-24" />
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 border-slate-200 text-slate-600 bg-white/50 rounded-xl">
            <Sparkles className="w-3 h-3 mr-1" />
            New Feature
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extralight mb-4 text-slate-900">
            HUD <span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">Overlay</span>
          </h1>
          <p className="font-text text-lg text-slate-600 mb-8 max-w-2xl mx-auto font-light">
            A beautiful floating overlay that shows what SpeakEasy is saying,
            with real-time audio-reactive waveforms.
          </p>
        </div>
      </section>

      {/* Video Demo */}
      <section className="pb-16 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 shadow-xl p-2">
            <div className="rounded-xl overflow-hidden bg-slate-900">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full"
              >
                <source src="/hud-demo-final.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-slate-600 flex items-center gap-2 shadow-sm border border-slate-200/50">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live Demo
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-16 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-extralight mb-3 text-slate-900">
              What Makes It <span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">Special</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <FeatureCard
              icon={<Waves className="w-5 h-5" />}
              title="Audio-Reactive Waveform"
              description="The waveform bars respond in real-time to the audio levels, creating a visual representation of the speech."
              badge="Real-time"
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="Zero CPU Impact"
              description="Optimized animations use GPU acceleration. The app idles at ~1% CPU even with the overlay active."
              badge="Optimized"
            />
            <FeatureCard
              icon={<Volume2 className="w-5 h-5" />}
              title="Word-by-Word Animation"
              description="Text appears word-by-word in sync with speech, making it easy to follow along."
              badge="Animated"
            />
            <FeatureCard
              icon={<Monitor className="w-5 h-5" />}
              title="Non-Intrusive Overlay"
              description="Floats above all windows without blocking clicks. Perfect for presentations and demos."
              badge="Seamless"
            />
          </div>
        </div>
      </section>

      {/* Technical Details */}
      <section className="pb-16 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-extralight mb-3 text-slate-900">
              How It <span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">Works</span>
            </h2>
          </div>
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-lg">
            <div className="space-y-6">
              <TechDetail
                title="Named Pipe Communication"
                description={<>The TypeScript library sends messages to the native macOS app via a Unix named pipe at <code className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-sm">/tmp/speakeasy-hud.fifo</code></>}
              />
              <TechDetail
                title="Real-Time Audio Levels"
                description="During playback, audio levels are streamed at ~30Hz to drive the waveform animation. The bars scale based on incoming amplitude data."
              />
              <TechDetail
                title="SwiftUI Native App"
                description="The overlay is a native macOS app built with SwiftUI, ensuring smooth 60fps animations and seamless system integration."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-2xl font-extralight mb-3 text-slate-900">Ready to Try It?</h2>
          <p className="font-text text-slate-600 mb-6 font-light">The HUD is included with SpeakEasy. Just enable it in the config app.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/docs/hud">
              <Button className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-full px-6">
                Read the Docs
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="rounded-full px-6 border-slate-300 text-slate-700 hover:bg-slate-50">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-50/50 border-t border-slate-200/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-6 text-sm">
              <a href="/features" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                Features
              </a>
              <a href="/docs/overview" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                Documentation
              </a>
              <a href="https://github.com/arach/SpeakEasy" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                GitHub
              </a>
            </div>
            <p className="text-sm text-slate-600">
              Made with ❤️ and 🤖 by <a href="https://arach.dev" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">Arach</a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  badge
}: {
  icon: React.ReactNode
  title: string
  description: string
  badge: string
}) {
  return (
    <div className="group relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-150 overflow-hidden">
      {/* Hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-blue-50/0 group-hover:from-emerald-50/50 group-hover:to-blue-50/30 transition-all duration-300 rounded-2xl" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl group-hover:from-emerald-100 group-hover:to-blue-100 transition-all duration-300">
            <div className="text-slate-600 group-hover:text-emerald-600 transition-colors duration-300">
              {icon}
            </div>
          </div>
          <div className="px-2.5 py-1 bg-slate-900 text-white rounded-full text-xs font-medium group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-blue-600 transition-all duration-300">
            {badge}
          </div>
        </div>
        <h3 className="font-display text-lg font-medium text-slate-900 mb-2">{title}</h3>
        <p className="font-text text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/0 to-blue-500/0 group-hover:from-emerald-500/10 group-hover:to-blue-500/10 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-all duration-500 -z-10" />
    </div>
  )
}

function TechDetail({
  title,
  description
}: {
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="border-l-2 border-emerald-500/30 pl-4">
      <h3 className="font-display text-base font-medium text-slate-900 mb-1">{title}</h3>
      <p className="font-text text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  )
}
