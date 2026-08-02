export default function ReadinessStrip({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-[11px] ${className}`}
      role="list"
      aria-label="Product readiness"
    >
      <span
        className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-100"
        role="listitem"
      >
        Player 0.2.17 · available now
      </span>
      <span
        className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-amber-100"
        role="listitem"
      >
        Exact-task listen · technical preview
      </span>
      <span
        className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200"
        role="listitem"
      >
        Source build for listening
      </span>
    </div>
  )
}
