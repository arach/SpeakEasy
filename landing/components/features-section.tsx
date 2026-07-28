import { ArrowUpRight, Boxes, Cloud, HardDrive, Terminal } from "lucide-react"
import { SPEAKEASY_PROVIDER_SUMMARY } from "@/lib/site"

const facts = [
  {
    icon: Terminal,
    label: "CLI first",
    value: "App optional",
    description:
      "Synthesize, play, or write audio from the CLI with --provider, --out, and --silent. Add the Mac player, HUD, and plugins when you want a richer agent workflow.",
    href: "/docs/cli/",
  },
  {
    icon: Cloud,
    label: "Providers",
    value: "Five adapters",
    description: `${SPEAKEASY_PROVIDER_SUMMARY}, behind one interface with provider-specific voice controls.`,
    href: "/docs/providers/",
  },
  {
    icon: HardDrive,
    label: "Cache",
    value: "SQLite built in",
    description: "API-provider audio can be cached by text and voice. Node 22.12+ or Bun 1.0+ supplies SQLite without native add-ons.",
    href: "/docs/cache/",
  },
  {
    icon: Boxes,
    label: "Surfaces",
    value: "CLI · SDK · Mac app",
    description: "Use only the layer you need. The native player adds queueing, playback controls, context, and task navigation when available.",
    href: "/docs/architecture/",
  },
] as const

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-white px-4 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">What it runs on</p>
          <h2 className="font-display text-4xl font-extralight text-slate-950 md:text-5xl">Start with speech. Add the workflow you need.</h2>
          <p className="mt-4 leading-relaxed text-slate-600">
            SpeakEasy&apos;s core TTS path stands on its own. The Mac app and agent integrations add playback and
            context without becoming a prerequisite for synthesis.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
          <div className="grid md:grid-cols-2">
            {facts.map((fact, index) => (
              <a
                key={fact.label}
                href={fact.href}
                className={`group p-6 transition-colors hover:bg-white md:p-8 ${
                  index % 2 === 0 ? "md:border-r md:border-slate-200" : ""
                } ${index < 2 ? "border-b border-slate-200" : index === 2 ? "border-b border-slate-200 md:border-b-0" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-xl border border-slate-200 bg-white p-2.5 text-emerald-700">
                    <fact.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">{fact.value}</span>
                </div>
                <h3 className="mt-6 text-lg font-medium text-slate-900">{fact.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{fact.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  Read the docs <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">macOS playback · TypeScript · MIT licensed</p>
        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          Unified Speech joins intentional input and output in the Mac technical preview. A standalone CLI listening
          command is product direction, not a currently shipped CLI feature.
        </p>
      </div>
    </section>
  )
}
