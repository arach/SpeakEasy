"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, MessageSquare, Volume2, ArrowRight, Terminal, Bell, Clock, Copy, ChevronLeft, ChevronRight, Play } from "lucide-react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import AudioWaveformPlayer from './audio-waveform-player'
import TerminalInterface from './terminal-interface'

const notificationExamples = [
  {
    trigger: "Claude needs your permission",
    spoken: "In SpeakEasy, Claude needs your permission",
    audioFile: "/audio/permission.mp3",
    icon: MessageSquare,
    color: "text-blue-600",
    hookType: "Tool Permission Request",
    terminalType: "permission" as const
  },
  {
    trigger: "Claude is waiting for your input",
    spoken: "In speakeasy, Claude is waiting for your input",
    audioFile: "/audio/waiting-input.mp3",
    icon: Bell,
    color: "text-amber-600",
    hookType: "Input Idle Notification",
    terminalType: "input" as const
  },
  {
    trigger: "Claude is waiting for you",
    spoken: "In speakeasy, Claude is waiting for you",
    audioFile: "/audio/waiting-for-you.mp3",
    icon: Clock,
    color: "text-purple-600",
    hookType: "General Waiting",
    terminalType: "waiting" as const
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-slate-200 text-slate-600 bg-white/50 rounded-xl hidden sm:inline-block">
              Use Case Example
            </Badge>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extralight mb-4 text-slate-900">
              Have <span className="font-light bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Claude speak</span> to you
            </h2>
            <p className="font-text text-lg text-slate-600 max-w-2xl mx-auto font-light">
              Never miss important notifications. Transform Claude Code's silent alerts into intelligent spoken updates.
            </p>
          </div>


          {/* Interactive Demo Carousel */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/40 p-6 sm:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Left Column: Alert + Audio (2 rows) */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Row 1: Notification Alert */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                          <CurrentIcon className={`w-5 h-5 ${notificationExamples[currentExample].color}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900 mb-1">
                            {notificationExamples[currentExample].hookType}
                          </h4>
                          <div className="text-xs text-slate-500 font-medium">
                            Trigger: "{notificationExamples[currentExample].trigger}"
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div className="text-sm text-slate-700">
                          <div className="font-medium mb-2">What Claude shows:</div>
                          <div className="font-mono text-xs bg-white rounded-lg p-3 border border-slate-200">
                            {notificationExamples[currentExample].trigger}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Audio Player */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">Audio Result</span>
                      </div>
                      
                      <AudioWaveformPlayer 
                        audioUrl={notificationExamples[currentExample].audioFile}
                        className="w-full shadow-md hover:shadow-lg transition-shadow duration-200"
                      />
                    </div>
                  </div>

                  {/* Right Column: Terminal Interface (spans full height) */}
                  <div className="lg:col-span-3 flex flex-col">
                    <div className="text-sm font-semibold text-slate-900 mb-4">
                      Visual Context
                    </div>
                    <div className="flex-1 flex items-start">
                      <TerminalInterface 
                        className="w-full" 
                        notificationType={notificationExamples[currentExample].terminalType}
                      />
                    </div>
                  </div>
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
          <div className="max-w-3xl mx-auto space-y-6">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="text-center">
                <a 
                  href="https://github.com/arach/hooked" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span className="text-sm font-medium">Hooked</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <p className="text-xs text-slate-500 mt-1">Ready-to-deploy handlers</p>
              </div>
              
              <div className="text-center">
                <a 
                  href="https://docs.anthropic.com/en/docs/claude-code/hooks" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <img src="https://wpforms.com/wp-content/uploads/2024/08/claude-logo.png" alt="Claude" className="w-8 h-8" />
                  <span className="text-sm font-medium">Claude Hooks</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <p className="text-xs text-slate-500 mt-1">Official documentation</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}