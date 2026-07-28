import PackageManagerTabs from "@/components/package-manager-tabs"
import { RELEASE } from "@/lib/release-status"

export default function BuildWithItSection() {
  return (
    <section id="build" className="bg-slate-50/70 px-4 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">The library</p>
          <h2 className="font-display text-4xl font-extralight text-slate-950 md:text-5xl">Three lines in your own code</h2>
          <p className="mt-4 font-text leading-relaxed text-slate-600">
            The same speech layer behind the Mac workflow is available as a typed package and CLI. npm currently
            publishes {RELEASE.npmLatest.version}.
          </p>
        </div>

        <PackageManagerTabs />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg shadow-slate-900/5">
            <div className="border-b border-white/10 px-5 py-3 text-xs font-medium text-slate-400">TypeScript</div>
            <pre className="overflow-x-auto p-5 text-sm leading-relaxed text-slate-300">
              <code>
                <span className="text-fuchsia-300">import</span>{" { "}
                <span className="text-sky-300">say</span>{" } "}
                <span className="text-fuchsia-300">from</span>{" "}
                <span className="text-amber-200">&apos;@arach/speakeasy&apos;</span>{";\n\n"}
                <span className="text-fuchsia-300">await</span>{" "}
                <span className="text-sky-300">say</span>{"("}
                <span className="text-amber-200">&apos;Build complete&apos;</span>{");\n"}
                <span className="text-fuchsia-300">await</span>{" "}
                <span className="text-sky-300">say</span>{"("}
                <span className="text-amber-200">&apos;Your agent needs you&apos;</span>{", "}
                <span className="text-amber-200">&apos;openai&apos;</span>{");"}
              </code>
            </pre>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg shadow-slate-900/5">
            <div className="border-b border-white/10 px-5 py-3 text-xs font-medium text-slate-400">CLI</div>
            <pre className="overflow-x-auto p-5 text-sm leading-relaxed text-slate-300">
              <code>
                <span className="text-emerald-300">speakeasy</span>{" "}
                <span className="text-amber-200">&quot;Build complete&quot;</span>{" "}
                <span className="text-sky-300">--provider</span>{" system\n"}
                <span className="text-emerald-300">speakeasy</span>{" "}
                <span className="text-amber-200">&quot;Save this&quot;</span>{" "}
                <span className="text-sky-300">--out</span>{" update.mp3 "}
                <span className="text-sky-300">--silent</span>
              </code>
            </pre>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
          <a href="/docs/quickstart/" className="font-medium text-emerald-700 hover:text-emerald-800">Quickstart →</a>
          <a href="/docs/sdk/" className="font-medium text-slate-600 hover:text-slate-900">SDK guide</a>
          <a href="/docs/cli/" className="font-medium text-slate-600 hover:text-slate-900">CLI reference</a>
        </div>
      </div>
    </section>
  )
}
