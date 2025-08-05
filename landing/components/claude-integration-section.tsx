"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, MessageSquare, Volume2, ArrowRight, Terminal, Bell, Copy, ChevronLeft, ChevronRight } from "lucide-react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import AudioWaveformPlayer from './audio-waveform-player'

const notificationExamples = [
  {
    trigger: "Claude needs your permission",
    spoken: "In SpeakEasy, Claude is waiting for your permissions",
    audioFile: "/audio/permission.mp3",
    icon: MessageSquare,
    color: "text-blue-600",
    hookType: "Tool Permission Request"
  },
  {
    trigger: "Claude is waiting for your input",
    spoken: "In SpeakEasy, Claude is waiting for your input",
    audioFile: "/audio/waiting-input.mp3",
    icon: Bell,
    color: "text-amber-600",
    hookType: "Input Idle Notification"
  },
  {
    trigger: "Notification received",
    spoken: "In SpeakEasy, notification received",
    audioFile: "/audio/build-complete.mp3",
    icon: Terminal,
    color: "text-green-600",
    hookType: "General Notification"
  }
]

const integrationCode = `// ~/.claude/hooks/notification.ts
import { SpeakEasy } from '@arach/speakeasy';

const speakEasy = new SpeakEasy({
  provider: 'groq',
  cache: { enabled: true, ttl: '7d' },
  fallbackOrder: ['groq', 'openai', 'system']
});

// Read notification from Claude Code
const notificationType = process.argv[2];
const payload = JSON.parse(await readStdin());

// Extract project context
const projectMatch = payload.transcript_path?.match(/\\/([^\\/]+)$/);
const projectName = projectMatch?.[1] || 'your project';

// Transform into natural speech
let spokenMessage = payload.message;
if (projectName !== 'your project') {
  spokenMessage = \`In \${projectName}, \${payload.message}\`;
}

// Speak the notification
await speakEasy.speak(spokenMessage);

// Also copy to clipboard and log
await copyToClipboard(JSON.stringify(payload, null, 2));
logger.info('Notification processed', { type: notificationType, message: spokenMessage });`

export default function ClaudeIntegrationSection() {
  const [currentExample, setCurrentExample] = useState(0)
  
  const nextExample = () => {
    setCurrentExample((prev) => (prev + 1) % notificationExamples.length)
  }
  
  const prevExample = () => {
    setCurrentExample((prev) => (prev - 1 + notificationExamples.length) % notificationExamples.length)
  }

  const CurrentIcon = notificationExamples[currentExample].icon

  return (
    <section className="relative">
      {/* Drop shadow separator */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-slate-900/5 to-transparent pointer-events-none" />
      
      <div className="py-16 px-4 bg-gradient-to-br from-blue-50/40 to-slate-50/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extralight mb-4 text-slate-900">
              Have <span className="font-light bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Claude speak</span> to you
            </h2>
            <p className="font-text text-base text-slate-600 max-w-2xl mx-auto font-light">
              Never miss important notifications. Transform Claude Code's silent alerts into intelligent spoken updates.
            </p>
          </div>

          {/* Centered Carousel Section */}
          <div className="max-w-4xl mx-auto mb-12">

            {/* Carousel */}
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 p-4 sm:p-8 mx-4 sm:mx-8">
                <div className="space-y-4 sm:space-y-6">
                  {/* Header with icon and trigger */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-50 to-blue-100">
                      <CurrentIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${notificationExamples[currentExample].color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs sm:text-sm text-slate-500 mb-1 font-medium">
                        Trigger: "{notificationExamples[currentExample].trigger}"
                      </div>
                    </div>
                  </div>
                  
                  {/* Audio Waveform Player */}
                  <AudioWaveformPlayer 
                    audioUrl={notificationExamples[currentExample].audioFile}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Navigation arrows */}
              <button
                onClick={prevExample}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={nextExample}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Dots indicator */}
            <div className="flex justify-center gap-2 mt-6">
              {notificationExamples.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentExample(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentExample 
                      ? 'bg-blue-600 w-6' 
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Implementation Section */}
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100/60 rounded-full text-sm text-emerald-800 border border-emerald-200/50">
                <Terminal className="w-4 h-4" />
                <span>Implementation</span>
              </div>
              <p className="text-slate-600 mt-2">How Hooked integrates with SpeakEasy</p>
            </div>

            <Card className="relative bg-slate-900 border-slate-700 overflow-hidden rounded-xl shadow-[0_8px_30px_rgb(0_0_0/0.12)] hover:shadow-[0_20px_40px_rgb(0_0_0/0.15)]">
              <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(integrationCode)}
                  className="text-slate-400 hover:text-white hover:bg-slate-700 h-5 w-5 p-0 rounded-md"
                  title="Copy to clipboard"
                >
                  <Copy className="w-2.5 h-2.5" />
                </Button>
              </div>
              <div className="text-[0.67rem] md:text-[0.9rem]">
                <SyntaxHighlighter
                  language="typescript"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent',
                    lineHeight: '1.3',
                    fontWeight: '200'
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontWeight: '200'
                    }
                  }}
                >
                  {integrationCode}
                </SyntaxHighlighter>
              </div>
            </Card>

            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
              <div className="text-sm text-slate-600 mb-3 font-medium">Learn more:</div>
              <div className="flex flex-col gap-2">
                <a 
                  href="https://github.com/arach/hooked" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors group"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Hooked notification system</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                
                <a 
                  href="https://docs.anthropic.com/en/docs/claude-code/hooks" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600 transition-colors group"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Claude Code hooks documentation</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-sm text-blue-700 border border-blue-200">
            <ArrowRight className="w-4 h-4" />
            <span>Ready to make Claude audible? Install SpeakEasy below</span>
          </div>
        </div>
      </div>
    </section>
  )
}