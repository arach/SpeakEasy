import HeroSection from "@/components/hero-section"
import FeaturesSection from "@/components/features-section"
import ClaudeIntegrationSection from "@/components/claude-integration-section"
import DownloadSection from "@/components/download-section"
import BuildWithItSection from "@/components/build-with-it-section"
import ListeningBand from "@/components/listening/listening-band"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 relative overflow-hidden">
      <HeroSection />
      <ClaudeIntegrationSection />
      <DownloadSection />
      <BuildWithItSection />
      <ListeningBand />
      <FeaturesSection />
      
      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-50/50 border-t border-slate-200/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
              <a href="/docs/quickstart/" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                Documentation
              </a>
              <a href="/docs/listening-mode/" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                Listening preview
              </a>
              <a href="https://github.com/arach/SpeakEasy/releases" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                Releases
              </a>
              <a href="https://github.com/arach/SpeakEasy" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                GitHub
              </a>
              <a href="https://www.npmjs.com/package/@arach/speakeasy" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-emerald-600 font-medium transition-colors">
                NPM
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
