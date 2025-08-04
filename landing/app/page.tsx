import { Suspense } from "react"
import HeroSection from "@/components/hero-section"
import FeaturesSection from "@/components/features-section"
import CodeExamples from "@/components/code-examples"
import GitHubRibbon from "@/components/github-ribbon"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 relative overflow-hidden">
      <GitHubRibbon />
      <HeroSection />
      <Suspense fallback={<div className="h-96" />}>
        <CodeExamples />
      </Suspense>
      <FeaturesSection />
      
      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-50/50 border-t border-slate-200/50">
        <div className="max-w-6xl mx-auto text-center">
          {/* Trigger deployment */}
          <p className="text-sm text-slate-600">
            Made with ❤️ and 🤖 by <a href="https://arach.dev" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">Arach</a>
          </p>
        </div>
      </footer>
    </main>
  )
}
