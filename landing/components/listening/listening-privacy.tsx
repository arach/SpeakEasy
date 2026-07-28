import { Check, Mic, RefreshCw, TriangleAlert } from "lucide-react"

const boundaries = [
  ["Records one explicit utterance per hotkey cycle", "Ambient listening or wake words"],
  ["Deletes temporary audio after transcription or cancel", "Writes raw audio or transcripts to speech history"],
  ["Fails visibly when a pinned microphone is missing", "Silently captures from another device"],
  ["Protects response audio as 0600 and removes it after playback", "Automatically re-arms for another turn"],
  ["Submits only to the Desktop-owned task", "Starts a shadow session or switches task mid-utterance"],
] as const

export default function ListeningPrivacy() {
  return (
    <section aria-labelledby="listening-privacy-heading" className="border-t border-white/[0.06] py-16 md:py-20">
      <div className="mb-10 max-w-3xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">Input and privacy</p>
        <h3 id="listening-privacy-heading" className="font-display text-3xl font-light text-white md:text-4xl">
          It listens when you say so, on the mic you chose
        </h3>
        <p className="mt-4 max-w-2xl font-text leading-relaxed text-slate-400">
          Follow the Mac&apos;s current input or pin a dedicated microphone. If that device disappears, SpeakEasy stops
          with a visible message rather than moving the conversation to another mic.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5">
          <div className="mb-5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-400">
            <span>Input policy</span>
            <span>Diagram · not app UI</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
            <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
              <span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
                <Mic className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-100">Dedicated microphone</p>
                <p className="text-xs text-slate-400">Persistent input preference</p>
              </div>
            </div>
            <div className="divide-y divide-white/[0.06]">
              <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-200">
                <span>System Default</span>
                <Check className="h-4 w-4 text-emerald-300" aria-label="Selected" />
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-300">
                <span>Named USB input</span>
                <span className="text-xs text-slate-400">Available</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm text-amber-300">
                <span>Saved studio mic</span>
                <span className="flex items-center gap-1 text-xs">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Missing
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh Inputs
              </div>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-xs leading-relaxed text-slate-400">
            <li><span className="font-medium text-slate-200">System Default</span> follows macOS; a named input is pinned by stable id.</li>
            <li>The active device name remains visible during recording.</li>
            <li>Selection locks while the voice turn is in progress.</li>
            <li className="font-mono text-[11px] text-slate-400">speakeasy.listening.input-device.v1</li>
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">SpeakEasy listening privacy boundaries</caption>
            <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th scope="col" className="w-1/2 px-4 py-4 font-medium md:px-6">Does</th>
                <th scope="col" className="w-1/2 border-l border-white/[0.06] px-4 py-4 font-medium md:px-6">Never does</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-sm leading-relaxed text-slate-300">
              {boundaries.map(([does, never]) => (
                <tr key={does}>
                  <td className="px-4 py-4 align-top md:px-6">{does}</td>
                  <td className="border-l border-white/[0.06] px-4 py-4 align-top text-slate-400 md:px-6">{never}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

