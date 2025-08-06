"use client"

import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'

interface TerminalInterfaceProps {
  onCommandSelect?: (command: string) => void
  className?: string
  notificationType?: 'permission' | 'input' | 'waiting'
}

const getTerminalScenario = (type: 'permission' | 'input' | 'waiting' = 'permission') => {
  switch (type) {
    case 'permission':
      return {
        command: "speakeasy --setup-hooks",
        description: "Configure Claude Code notifications",
        fileOperation: "⏺ Update(.claude/hooks/notif.ts)",
        fileResult: "⎿ Updated .claude/hooks/notif.ts with 10 additions",
        prompt: "Do you want to proceed?",
        options: [
          { id: 1, text: "Yes", description: "" },
          { id: 2, text: "Yes, and don't ask again for speakeasy commands in .claude/hooks/notif.ts", description: "" },
          { id: 3, text: "No, and tell Claude what to do differently (...)", description: "" }
        ]
      }
    case 'input':
      return {
        command: "claude code --interactive",
        description: "Start interactive coding session",
        fileOperation: "⏸ Waiting for user input...",
        fileResult: "⎿ Session paused - awaiting your response",
        prompt: "Would you like to continue or get a notification?",
        options: [
          { id: 1, text: "Continue session", description: "" },
          { id: 2, text: "Notify me when ready", description: "" },
          { id: 3, text: "End session", description: "" }
        ]
      }
    case 'waiting':
      return {
        command: "claude analyze project",
        description: "Analyzing project structure",
        fileOperation: "⏳ Processing large codebase...",
        fileResult: "⎿ Analysis complete - ready for review",
        prompt: "How would you like to proceed?",
        options: [
          { id: 1, text: "Review results now", description: "" },
          { id: 2, text: "Save results and notify me", description: "" },
          { id: 3, text: "Cancel analysis", description: "" }
        ]
      }
  }
}

export default function TerminalInterface({ onCommandSelect, className = "", notificationType = 'permission' }: TerminalInterfaceProps) {
  const [selectedCommand, setSelectedCommand] = useState<number | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const scenario = getTerminalScenario(notificationType)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPrompt(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleCommandClick = (command: typeof scenario.options[0]) => {
    setSelectedCommand(command.id)
    onCommandSelect?.(command.text)
  }

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700/50">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
      </div>

      {/* Terminal Content */}
      <div className="p-4 font-mono text-xs">
        {/* Initial Command */}
        <div className="mb-4">
          <div className="flex items-center text-slate-300 mb-1">
            <ChevronRight className="w-3 h-3 mr-1.5 text-emerald-400" />
            <span className="text-emerald-400">{scenario.command}</span>
          </div>
          <div className="text-slate-500 text-xs ml-4 mb-2">
            {scenario.description}
          </div>
          
          {/* File Update Operation */}
          <div className="ml-4 mb-3 text-xs">
            <div className="text-blue-400 mb-0.5">
              {scenario.fileOperation}
            </div>
            <div className="text-slate-400 ml-2">
              {scenario.fileResult}
            </div>
          </div>
        </div>

        {/* Prompt Question */}
        {showPrompt && (
          <div className="space-y-2">
            <div className="text-slate-200 mb-3 text-xs">
              {scenario.prompt}
            </div>

            {/* Command Options */}
            <div className="space-y-1.5">
              {scenario.options.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => handleCommandClick(command)}
                  className={`w-full text-left flex items-start gap-2 p-2.5 rounded-lg transition-all duration-200 ${
                    selectedCommand === command.id
                      ? 'bg-emerald-600/20 border border-emerald-500/30'
                      : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/30'
                  }`}
                >
                  <span className={`text-xs font-medium mt-0.5 ${
                    selectedCommand === command.id ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <div className={`text-xs leading-relaxed ${
                      selectedCommand === command.id ? 'text-emerald-200' : 'text-slate-200'
                    }`}>
                      {command.text}
                    </div>
                    {command.description && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {command.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cursor */}
        {showPrompt && (
          <div className="flex items-center mt-3 text-slate-300">
            <ChevronRight className="w-3 h-3 mr-1.5 text-emerald-400" />
            <span className="animate-pulse text-xs">_</span>
          </div>
        )}
      </div>
    </div>
  )
}