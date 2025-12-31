"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Terminal, Settings, Volume2, Download } from "./icons"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const codeExamples = {
  basic: {
    language: 'typescript',
    code: `import { say } from '@arach/speakeasy';

// Quick start - one line!
await say('Hello world!');

// With provider
await say('Hello from OpenAI!', 'openai');
await say('Hello from ElevenLabs!', 'elevenlabs');`
  },

  advanced: {
    language: 'typescript',
    code: `import { speak, SpeakEasy } from '@arach/speakeasy';

// Full featured with options
await speak('Priority message', {
  provider: 'openai',
  volume: 0.8,
  priority: 'high'
});

// Custom instance
const speech = new SpeakEasy({
  provider: 'elevenlabs',
  volume: 0.6,
  rate: 200
});

await speech.speak('Custom configuration');`
  },

  cli: {
    language: 'bash',
    code: `# Install globally
npm install -g @arach/speakeasy

# Quick setup - save your API key
speakeasy --set-key elevenlabs YOUR_API_KEY

# Set as default provider
speakeasy --set-default elevenlabs

# Start speaking!
speakeasy "Hello world"

# Or use system voice (no API key needed)
speakeasy "Hello world" --provider system`
  },

  config: {
    language: 'json',
    code: `// ~/.config/speakeasy/settings.json
{
  "providers": {
    "openai": {
      "voice": "nova",
      "apiKey": "sk-..."
    },
    "elevenlabs": {
      "voiceId": "EXAVITQu4vr4xnSDxMaL",
      "apiKey": "sk-..."
    }
  },
  "defaults": {
    "provider": "openai",
    "volume": 0.7,
    "rate": 180
  }
}`
  }
}

export default function CodeExamples() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined)
  const contentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  useEffect(() => {
    const updateHeight = () => {
      const activeContent = contentRefs.current[activeTab]
      if (activeContent) {
        setContainerHeight(activeContent.scrollHeight)
      }
    }
    
    // Update height immediately and after a small delay for SyntaxHighlighter to render
    updateHeight()
    const timer = setTimeout(updateHeight, 50)
    
    return () => clearTimeout(timer)
  }, [activeTab])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  return (
    <section className="pt-0 pb-6 px-4 bg-slate-50/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extralight mb-3 text-slate-900">
            Start Speaking in<span className="font-light bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> Seconds</span>
          </h2>
          <p className="font-text text-base text-slate-600 max-w-2xl mx-auto font-light">
            No complex setup, no boilerplate. Choose your style and start building.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="inline-flex bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-1 shadow-lg shadow-slate-200/50">
              <TabsTrigger 
                value="basic" 
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm relative z-10 transition-all duration-300 ease-in-out before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300 before:ease-in-out data-[state=active]:before:bg-white data-[state=active]:before:shadow-md data-[state=active]:before:border data-[state=active]:text-emerald-700 data-[state=active]:before:border-emerald-200/50 data-[state=active]:before:shadow-emerald-200/30 data-[state=active]:before:-inset-x-1.5 data-[state=active]:before:-inset-y-0 data-[state=inactive]:before:bg-transparent data-[state=inactive]:before:shadow-none data-[state=inactive]:before:border-transparent data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:before:bg-slate-50/50"
              >
                <Terminal className="w-3 h-3 sm:w-4 sm:h-4 relative z-10" />
                <span className="relative z-10">Start</span>
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm relative z-10 transition-all duration-300 ease-in-out before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300 before:ease-in-out data-[state=active]:before:bg-white data-[state=active]:before:shadow-md data-[state=active]:before:border data-[state=active]:text-blue-700 data-[state=active]:before:border-blue-200/50 data-[state=active]:before:shadow-blue-200/30 data-[state=active]:before:-inset-x-1 data-[state=active]:before:-inset-y-0 data-[state=inactive]:before:bg-transparent data-[state=inactive]:before:shadow-none data-[state=inactive]:before:border-transparent data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:before:bg-slate-50/50"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 relative z-10" />
                <span className="relative z-10">Advanced</span>
              </TabsTrigger>
              <TabsTrigger 
                value="cli" 
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm relative z-10 transition-all duration-300 ease-in-out before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300 before:ease-in-out data-[state=active]:before:bg-white data-[state=active]:before:shadow-md data-[state=active]:before:border data-[state=active]:text-purple-700 data-[state=active]:before:border-purple-200/50 data-[state=active]:before:shadow-purple-200/30 data-[state=active]:before:-inset-x-1 data-[state=active]:before:-inset-y-0 data-[state=inactive]:before:bg-transparent data-[state=inactive]:before:shadow-none data-[state=inactive]:before:border-transparent data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:before:bg-slate-50/50"
              >
                <Terminal className="w-3 h-3 sm:w-4 sm:h-4 relative z-10" />
                <span className="relative z-10">CLI</span>
              </TabsTrigger>
              <TabsTrigger 
                value="config" 
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm relative z-10 transition-all duration-300 ease-in-out before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300 before:ease-in-out data-[state=active]:before:bg-white data-[state=active]:before:shadow-md data-[state=active]:before:border data-[state=active]:text-orange-700 data-[state=active]:before:border-orange-200/50 data-[state=active]:before:shadow-orange-200/30 data-[state=active]:before:-inset-x-1.5 data-[state=active]:before:-inset-y-0 data-[state=inactive]:before:bg-transparent data-[state=inactive]:before:shadow-none data-[state=inactive]:before:border-transparent data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:before:bg-slate-50/50"
              >
                <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 relative z-10" />
                <span className="relative z-10">Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex justify-center">
            <Card className="relative bg-slate-900 border-slate-700 overflow-hidden rounded-xl w-full max-w-2xl shadow-[0_8px_30px_rgb(0_0_0/0.12)] hover:shadow-[0_20px_40px_rgb(0_0_0/0.15)]">
              <div className="flex items-center justify-between px-1.5 py-0.5 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(codeExamples[activeTab as keyof typeof codeExamples].code, activeTab)}
                  className="text-slate-400 hover:text-white hover:bg-slate-700 h-5 w-5 p-0 rounded-md"
                  title={copiedCode === activeTab ? "Copied!" : "Copy to clipboard"}
                >
                  {copiedCode === activeTab ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </Button>
              </div>
              <div 
                className="relative overflow-hidden transition-all duration-300 ease-out"
                style={{ height: containerHeight ? `${containerHeight}px` : 'auto' }}
              >
                {Object.entries(codeExamples).map(([key, example]) => (
                  <div
                    key={key}
                    ref={(el) => (contentRefs.current[key] = el)}
                    className={`transition-all duration-300 ease-out overflow-x-auto ${
                      activeTab === key 
                        ? 'opacity-100 transform translate-y-0' 
                        : 'opacity-0 transform translate-y-2 absolute inset-0 pointer-events-none'
                    }`}
                  >
                    <div className="text-[0.67rem] md:text-[0.9rem]">
                      <SyntaxHighlighter
                        language={example.language}
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
                        {example.code}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Tabs>

      </div>
    </section>
  )
}