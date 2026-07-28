"use client"

import { useRef, useState } from "react"
import { ArrowRight, CircleOff, LockKeyhole } from "lucide-react"

type Lane = {
  number: number
  title: string
  directory?: string
  taskId?: string
}

const lanes: Lane[] = [
  { number: 1, title: "Orchestrator", directory: "workspace/", taskId: "019f9573-…-afe5" },
  { number: 2, title: "SpeakEasy listening", directory: "speakeasy/", taskId: "019f99a4-…-a603" },
  { number: 3, title: "Hudson speech service", directory: "hudson/", taskId: "019f9aa7-…-831a3" },
  ...Array.from({ length: 6 }, (_, index) => ({
    number: index + 4,
    title: "Unassigned",
  })),
]

export default function VoiceLanes() {
  const [selectedLane, setSelectedLane] = useState(1)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selected = lanes.find((lane) => lane.number === selectedLane) ?? lanes[0]

  const moveFocus = (index: number, delta: number) => {
    const nextIndex = (index + delta + lanes.length) % lanes.length
    itemRefs.current[nextIndex]?.focus()
    setSelectedLane(lanes[nextIndex].number)
  }

  return (
    <section aria-labelledby="voice-lanes-heading" className="py-12 md:py-14">
      <div className="mb-10 max-w-3xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">Exact-task routing</p>
        <h3 id="voice-lanes-heading" className="font-display text-3xl font-light text-white md:text-4xl">
          Nine lanes, nine exact tasks
        </h3>
        <p className="mt-4 max-w-2xl font-text leading-relaxed text-slate-400">
          Assign the current lock to a lane and it stays there. Each lane holds one task id — a swim lane for each
          project, agent, or piece of work you have running.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <span className="text-sm font-medium text-slate-200">Example lane map</span>
            <span className="text-xs text-slate-400">Hover, focus, or select</span>
          </div>
          <ul aria-label="Example voice lanes" className="divide-y divide-white/[0.06]">
            {lanes.map((lane, index) => {
              const isAssigned = Boolean(lane.taskId)
              const isSelected = lane.number === selectedLane

              return (
                <li key={lane.number} className={isSelected ? "bg-emerald-400/[0.06]" : ""}>
                  <button
                    ref={(element) => {
                      itemRefs.current[index] = element
                    }}
                    type="button"
                    tabIndex={isSelected ? 0 : -1}
                    aria-current={isSelected ? "true" : undefined}
                    onFocus={() => setSelectedLane(lane.number)}
                    onMouseEnter={() => setSelectedLane(lane.number)}
                    onClick={() => setSelectedLane(lane.number)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                        event.preventDefault()
                        moveFocus(index, 1)
                      }
                      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                        event.preventDefault()
                        moveFocus(index, -1)
                      }
                    }}
                    className={`grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-150 focus-visible:ring-inset focus-visible:ring-emerald-400 focus-visible:ring-offset-0 ${
                      isSelected ? "border-emerald-400" : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <kbd className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-center font-silkscreen text-[10px] text-slate-300">
                      ⌘⌥{lane.number}
                    </kbd>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm ${isAssigned ? "text-slate-200" : "text-slate-400"}`}>
                        {lane.title}
                      </span>
                      {lane.directory ? (
                        <span className="block truncate font-mono text-[11px] text-slate-400">{lane.directory}</span>
                      ) : null}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${isAssigned ? "bg-emerald-400" : "border border-slate-500"}`}
                      aria-label={isAssigned ? "Assigned" : "Unassigned"}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex min-h-[30rem] flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
          <div>
            <div className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5 text-emerald-400" />
              Routing authority
            </div>
            {selected.taskId ? (
              <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr_auto_1.35fr]">
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <span className="block font-silkscreen text-[10px] text-emerald-300">LANE {selected.number}</span>
                  <span className="mt-1 block text-sm text-white">{selected.title}</span>
                </div>
                <ArrowRight className="mx-auto hidden h-5 w-5 text-slate-600 sm:block" aria-hidden="true" />
                <div className="text-center font-mono text-[11px] leading-relaxed text-slate-400">
                  reopen +<br />revalidate
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <span className="block text-xs text-slate-400">Existing Codex Desktop task</span>
                  <span className="mt-2 block font-mono text-sm text-slate-200">{selected.taskId}</span>
                </div>
              </div>
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center">
                <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                  Lane {selected.number} is unassigned. It will not infer a task or submit anywhere.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4 text-slate-400">
              <CircleOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <p className="text-sm">
                <span className="font-medium text-slate-300">No new session or shadow task.</span> Codex Desktop keeps
                ownership of the conversation already in progress.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3 border-t border-white/[0.06] pt-6 text-sm leading-relaxed text-slate-400">
            <p>Only the task id is routing authority. Titles and directories are display metadata.</p>
            <p>Every activation reopens and revalidates that exact task, including after a restart.</p>
            <p>An idle task starts a turn; an active task receives Desktop&apos;s same-task steer.</p>
          </div>

          <p className="sr-only">
            The selected lane routes to its saved exact task id in the existing Codex Desktop task. No new session is
            created.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">
        {[
          ["⌃⌥Space", "Toggle listen on the current lock"],
          ["⌘⌥1…9", "Select a lane and begin listening"],
          ["⌘⌥X", "Announce the active lane without opening the mic"],
        ].map(([keys, label]) => (
          <div key={keys} className="flex items-center gap-3 bg-slate-950 px-4 py-4">
            <kbd className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-200">
              {keys}
            </kbd>
            <span className="text-xs leading-relaxed text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
