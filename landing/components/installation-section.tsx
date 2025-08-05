"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Terminal, Globe, Download, ExternalLink } from "lucide-react"

export default function InstallationSection() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const copyToClipboard = async (command: string, id: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(id)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const installations = [
    {
      id: "npm",
      title: "NPM",
      command: "npm install @arach/speakeasy",
      description: "Standard Node.js package manager"
    },
    {
      id: "pnpm",
      title: "PNPM",
      command: "pnpm install @arach/speakeasy",
      description: "Fast, disk space efficient"
    },
    {
      id: "yarn",
      title: "Yarn",
      command: "yarn add @arach/speakeasy",
      description: "Secure, reliable, reproducible"
    }
  ]

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-blue-200 text-blue-700 bg-blue-50">
            <Download className="w-3 h-3 mr-2" />
            Ready to Ship
          </Badge>
          <h2 className="font-display text-4xl md:text-5xl font-light mb-6 text-slate-900">
            Get Started Now
          </h2>
          <p className="font-text text-xl text-slate-600 max-w-2xl mx-auto">
            Install SpeakEasy and start speaking in under 30 seconds.
          </p>
        </div>

        {/* Installation Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {installations.map((install) => (
            <Card key={install.id} className="relative group hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                  {install.title}
                  <Terminal className="w-4 h-4 text-slate-400" />
                </CardTitle>
                <p className="text-sm text-slate-500">{install.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg font-mono text-sm">
                  <code className="text-emerald-400">{install.command}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(install.command, install.id)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800 h-6 w-6 p-0"
                  >
                    {copiedCommand === install.id ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Start */}
        <Card className="mb-12 bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <Terminal className="w-5 h-5" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                <div className="font-mono text-sm">
                  <div className="text-slate-400 mb-1"># 1. Install the package</div>
                  <div className="text-emerald-400">npm install @arach/speakeasy</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("npm install @arach/speakeasy", "quickstart")}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  {copiedCommand === "quickstart" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              <div className="p-4 bg-slate-900 rounded-lg font-mono text-sm">
                <div className="text-slate-400 mb-2"># 2. Start speaking (JavaScript/TypeScript)</div>
                <div className="text-blue-400">import</div>
                <div className="text-slate-300"> {"{ say }"} </div>
                <div className="text-blue-400">from</div>
                <div className="text-green-400"> '@arach/speakeasy'</div>
                <div className="text-slate-300">;</div>
                <br />
                <div className="text-blue-400">await</div>
                <div className="text-yellow-400"> say</div>
                <div className="text-slate-300">(</div>
                <div className="text-green-400">'Hello world!'</div>
                <div className="text-slate-300">);</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="group hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">npm Registry</h3>
                    <p className="text-sm text-slate-500">Official package</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <a href="https://www.npmjs.com/package/@arach/speakeasy" target="_blank" rel="noopener noreferrer">
                  View on NPM
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">GitHub Repo</h3>
                    <p className="text-sm text-slate-500">Source code & docs</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <a href="https://github.com/arach/SpeakEasy" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}