import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AudioLines, Download, Github, MessageSquareText, ShieldCheck } from "lucide-react"

export default function DownloadSection() {
  return (
    <section id="download" className="py-28 px-4 bg-gradient-to-b from-white to-emerald-50/40">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <Badge variant="outline" className="mb-6 border-emerald-200 text-emerald-700 bg-white/70 rounded-xl">
            Native macOS player
          </Badge>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            A permanent place for every spoken update
          </h2>
          <p className="font-text text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-12">
            SpeakEasy gives Codex and your command line one menu-bar player for autoplay, queues, scrubbing,
            playback speed, volume, and a word-synced transcript HUD.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              asChild
              size="lg"
              className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-base font-medium rounded-xl shadow-lg"
            >
              <a href="https://github.com/arach/SpeakEasy/releases/latest/download/SpeakEasy.dmg">
                <Download className="mr-2 w-5 h-5" />
                Download signed app
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 text-base bg-white rounded-xl"
            >
              <a href="https://github.com/arach/SpeakEasy" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 w-5 h-5" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>

        <Card className="max-w-3xl mx-auto mb-10 overflow-hidden bg-white/70 backdrop-blur-xl border border-white shadow-2xl shadow-emerald-950/10 rounded-3xl">
          <CardContent className="p-4 md:p-7">
            <Image
              src="/menu-bar-player.png"
              alt="SpeakEasy menu-bar player showing its playback controls and live transcript"
              width={525}
              height={250}
              priority
              className="w-full rounded-2xl border border-slate-200/80"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: AudioLines,
              title: "One native player",
              description: "Narration from Codex and the CLI lands in the same lightweight menu-bar app.",
            },
            {
              icon: MessageSquareText,
              title: "Stay in context",
              description: "Follow every word in the live HUD, then jump back to the originating Codex task.",
            },
            {
              icon: ShieldCheck,
              title: "Local by default",
              description: "Use the macOS system voice with no account, or opt into your configured cloud provider.",
            },
          ].map((feature) => (
            <Card key={feature.title} className="bg-white/60 backdrop-blur-xl border border-white/30 shadow-lg rounded-2xl">
              <CardContent className="p-8 text-center">
                <feature.icon className="w-8 h-8 text-emerald-600 mx-auto mb-4" />
                <div className="font-display text-2xl font-medium text-slate-900 mb-3">{feature.title}</div>
                <div className="font-text text-slate-600 leading-relaxed">{feature.description}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Requirements */}
        <Card className="bg-white/40 backdrop-blur-xl border border-white/30 shadow-lg rounded-2xl">
          <CardContent className="p-8">
            <h3 className="font-display text-xl font-medium text-slate-900 mb-6 text-center">Ready for your Mac and your agents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-text font-medium text-slate-700 mb-3">Native player</h4>
                <ul className="font-text text-sm text-slate-600 space-y-1">
                  <li>• macOS 14.0 or later</li>
                  <li>• Apple Silicon or Intel processor</li>
                  <li>• Developer ID signed and Apple notarized</li>
                </ul>
              </div>
              <div>
                <h4 className="font-text font-medium text-slate-700 mb-3">Codex plugin</h4>
                <ul className="font-text text-sm text-slate-600 space-y-1">
                  <li>• Bundled SpeakEasy runtime</li>
                  <li>• System voice works without an API key</li>
                  <li>• OpenAI, ElevenLabs, Groq, and Gemini are optional</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
