"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Package, Zap, Shield, Download } from "lucide-react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const packageManagers = {
  npm: {
    icon: Package,
    command: "npm install @arach/speakeasy",
    description: "Standard Node.js package manager"
  },
  pnpm: {
    icon: Zap,
    command: "pnpm install @arach/speakeasy",
    description: "Fast, disk space efficient"
  },
  yarn: {
    icon: Shield,
    command: "yarn add @arach/speakeasy",
    description: "Secure, reliable, reproducible"
  },
  bun: {
    icon: Download,
    command: "bun add @arach/speakeasy",
    description: "Lightning fast JavaScript runtime"
  }
}

export default function PackageManagerTabs() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const copyToClipboard = async (command: string, id: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(id)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Tabs defaultValue="npm" className="w-full">
        <div className="flex justify-center mb-4">
          <TabsList className="inline-flex bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-1 shadow-lg shadow-slate-200/50">
            {Object.entries(packageManagers).map(([key, pm], index) => (
              <TabsTrigger 
                key={key}
                value={key}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm relative z-10 transition-all duration-300 ease-in-out before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300 before:ease-in-out data-[state=active]:before:bg-white data-[state=active]:before:shadow-md data-[state=active]:before:border data-[state=active]:text-emerald-700 data-[state=active]:before:border-emerald-200/50 data-[state=active]:before:shadow-emerald-200/30 data-[state=inactive]:before:bg-transparent data-[state=inactive]:before:shadow-none data-[state=inactive]:before:border-transparent data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:before:bg-slate-50/50 ${
                  index === 0 ? 'data-[state=active]:before:-inset-x-1.5 data-[state=active]:before:-inset-y-0' : 
                  index === Object.keys(packageManagers).length - 1 ? 'data-[state=active]:before:-inset-x-1.5 data-[state=active]:before:-inset-y-0' :
                  'data-[state=active]:before:-inset-x-1 data-[state=active]:before:-inset-y-0'
                }`}
              >
                <pm.icon className="w-3 h-3 sm:w-4 sm:h-4 relative z-10" />
                <span className="relative z-10">{key.toUpperCase()}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-md px-4 sm:px-0">
            {Object.entries(packageManagers).map(([key, pm]) => (
              <TabsContent key={key} value={key} className="mt-0">
                <div className="relative bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-sm mx-4 sm:mx-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(pm.command, key)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-white hover:bg-slate-700 h-6 w-6 p-0 rounded-md z-10"
                    title={copiedCommand === key ? "Copied!" : "Copy to clipboard"}
                  >
                    {copiedCommand === key ? (
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
                      fontWeight: '300'
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        fontWeight: '300'
                      }
                    }}
                  >
                    {pm.command}
                  </SyntaxHighlighter>
                </div>
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  )
}