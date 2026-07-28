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
            SpeakEasy for Mac
          </Badge>
          <h2 className="font-display text-5xl md:text-6xl font-extralight text-slate-900 mb-6 leading-tight">
            Listen to your work while you keep moving
          </h2>
          <p className="font-text text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-12">
            Turn output from agents, scripts, and tools into clear, controllable speech. Use it deeply with
            Codex, or bring it into any workflow that can call the CLI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              asChild
              size="lg"
              className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-4 text-base font-medium rounded-xl shadow-lg"
            >
              <a href="https://github.com/arach/SpeakEasy/releases/latest/download/SpeakEasy.dmg">
                <Download className="mr-2 w-5 h-5" />
                Download
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
              description: "Follow every word in the live HUD. When a validated source task id is present, jump straight back to that Codex task.",
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
                <h4 className="font-text font-medium text-slate-700 mb-3">Near-native agent integration</h4>
                <ul className="font-text text-sm text-slate-600 space-y-1">
                  <li>• Agent responses arrive automatically in the Mac player</li>
                  <li>• Originating task context is retained when the integration provides it</li>
                  <li>• No separate app or integration flow to operate during a turn</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
