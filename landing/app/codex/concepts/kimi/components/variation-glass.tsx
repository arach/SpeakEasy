import {
  ArrowRight,
  AudioLines,
  Headphones,
  ListMusic,
  LockKeyhole,
  Mic,
  Volume2,
} from "lucide-react"
import ReadinessStrip from "./readiness-strip"

function MiniWave({ tone = "blue" }: { tone?: "blue" | "emerald" }) {
  const bars = [24, 40, 32, 48, 36, 56, 28, 44, 38, 52, 30, 46, 34, 50, 26]
  const from = tone === "blue" ? "from-blue-600" : "from-emerald-600"
  const to = tone === "blue" ? "to-blue-300" : "to-emerald-300"
  return (
    <div className="flex items-end justify-center gap-[2px] h-8" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-gradient-to-t ${from} ${to} motion-safe:animate-pulse`}
          style={{
            height: `${h}%`,
            animationDelay: `${i * 55}ms`,
            opacity: 0.5 + (i % 5) * 0.08,
          }}
        />
      ))}
    </div>
  )
}

export default function VariationGlass() {
  const queue = [
    { title: "Codex response · lane 1", duration: "0:43", active: true },
    { title: "Earlier summary · lane 1", duration: "0:21", active: false },
    { title: "Permission hook · Claude", duration: "0:08", active: false },
  ]

  return (
    <section
      id="glass"
      aria-labelledby="glass-title"
      className="scroll-mt-40 bg-gradient-to-br from-white via-slate-50/80 to-blue-50/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-600">
              VARIATION 03
            </p>
            <h2
              id="glass-title"
              className="mt-2 font-display text-3xl font-extralight tracking-tight text-slate-900 sm:text-4xl"
            >
              Glass Player
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              The native menu-bar player is the visible proof: the real Codex response, queued,
              controlled, and traced back to its originating task.
            </p>
          </div>
          <ReadinessStrip />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            The answer has a surface
          </p>
          <h3 className="mt-4 font-display text-4xl font-extralight leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            One native player.{" "}
            <span className="block bg-gradient-to-r from-slate-700 via-blue-700 to-emerald-700 bg-clip-text font-light text-transparent">
              Always tied to the real task.
            </span>
          </h3>
          <p className="mx-auto mt-6 max-w-2xl text-base font-light leading-7 text-slate-600 sm:text-lg">
            SpeakEasy is not a dashboard. It is a Mac instrument: a deliberate microphone control and
            a permanent glass player with queue, speed, volume, HUD, and a path back to the
            originating Codex task.
          </p>
        </div>

        {/* Glass stage */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div
            className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-blue-200/30 via-emerald-100/20 to-white blur-3xl motion-reduce:hidden"
            aria-hidden="true"
          />

          <div className="relative">
            {/* Mic trigger orb */}
            <div className="absolute -top-8 left-4 z-10 sm:left-8 lg:-top-10">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-xl shadow-emerald-900/20 outline-none ring-4 ring-emerald-100 transition hover:scale-[1.02] focus-visible:ring-emerald-300 motion-reduce:transition-none"
                  aria-label="Hold Control-Option-Space to begin or end one utterance"
                >
                  <span
                    className="absolute inset-0 rounded-full bg-emerald-400/30 motion-safe:animate-ping motion-reduce:hidden"
                    style={{ animationDuration: "2.4s" }}
                    aria-hidden="true"
                  />
                  <Mic className="relative h-6 w-6" />
                </button>
                <p className="mt-2 font-mono text-[10px] font-semibold text-slate-700">⌃⌥Space</p>
              </div>
            </div>

            {/* Glass card */}
            <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/75 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
              {/* Title bar */}
              <div className="flex items-center justify-between border-b border-white/60 bg-white/50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white">
                    <Headphones className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">SpeakEasy player</p>
                    <p className="text-[10px] text-slate-500">Menu-bar · lane 1 locked</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
                  Available now
                </span>
              </div>

              <div className="p-5 sm:p-7">
                {/* Task back-link */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <LockKeyhole className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-medium text-slate-900">
                      Explain SpeakEasy’s new product story
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">019f…a4c1</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-slate-800 motion-reduce:transition-none"
                  >
                    Open task
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {/* HUD */}
                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Live HUD
                    </p>
                    <Volume2 className="h-3.5 w-3.5 text-blue-300" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Stable 0.2.17 ships the player and TTS. Exact-task listening is an opt-in
                    technical preview on master, source-built, using a private version-checked Codex
                    Desktop IPC seam.
                  </p>
                </div>

                {/* Progress + transport */}
                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        Codex response · lane 1
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Real response from the locked task
                      </p>
                    </div>
                    <MiniWave tone="blue" />
                  </div>

                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-400">
                      <span>0:18</span>
                      <span>0:43</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400">
                      <span className="sr-only">Previous</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M6 6h2v12H6zm12 0-8 6 8 6z" />
                      </svg>
                    </span>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
                      <span className="sr-only">Pause</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400">
                      <span className="sr-only">Next</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16 6h2v12h-2zM6 18V6l8 6z" />
                      </svg>
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Speed", "1.0×"],
                      ["Volume", "70%"],
                      ["Queue", "2 ahead"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Queue */}
                <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/60 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <ListMusic className="h-3.5 w-3.5" />
                    Playback queue
                  </div>
                  <ul className="mt-3 space-y-2">
                    {queue.map((item, i) => (
                      <li
                        key={item.title}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                          item.active
                            ? "border-blue-200 bg-blue-50/60 text-slate-900"
                            : "border-slate-100 bg-white/80 text-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{i + 1}</span>
                          <span className={item.active ? "font-medium" : ""}>{item.title}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{item.duration}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Annotation */}
            <div className="absolute -bottom-6 right-4 max-w-[16rem] rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-lg backdrop-blur-sm sm:right-8">
              <p className="text-[11px] leading-4 text-slate-600">
                <span className="font-semibold text-slate-900">Path back to task.</span> Every
                spoken response keeps a link to the exact Codex conversation that produced it.
              </p>
            </div>
          </div>
        </div>

        {/* Honest boundaries */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              title: "Stable now",
              body: "Signed SpeakEasy 0.2.17 player and TTS. System narration works without a cloud voice account.",
            },
            {
              title: "Preview listen",
              body: "Exact-task Codex listening is opt-in on master, source-built, via a private Desktop IPC seam—not a public API.",
            },
            {
              title: "Plugin path",
              body: "Codex plugin is packaged; public directory listing is still in progress. Two-way Claude is next, not today.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
            >
              <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
