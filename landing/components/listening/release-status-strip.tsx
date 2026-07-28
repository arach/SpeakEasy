import { RELEASE } from "@/lib/release-status"

type ReleaseStatusStripProps = {
  variant?: "hero" | "zone"
  className?: string
}

type ReleaseStatusItem = {
  label: string
  value: string
  dot: string
  title: string
  href?: string
}

const items: ReleaseStatusItem[] = [
  {
    label: "Menu-bar player",
    value: `Released in ${RELEASE.player.in}`,
    dot: "bg-emerald-500",
    title: `Included in the ${RELEASE.appDmg.label}`,
  },
  {
    label: "Listening mode",
    value: "Preview · build from source",
    dot: "bg-amber-400",
    title: RELEASE.listening.note,
    href: "#listening",
  },
  {
    label: "npm @arach/speakeasy",
    value: RELEASE.npmLatest.version,
    dot: "bg-slate-400",
    title: `Latest published npm version: ${RELEASE.npmLatest.version}`,
  },
]

export default function ReleaseStatusStrip({
  variant = "hero",
  className = "",
}: ReleaseStatusStripProps) {
  const textColor = variant === "zone" ? "text-slate-400" : "text-slate-500"
  const labelColor = variant === "zone" ? "text-slate-200" : "text-slate-700"
  const dividerColor = variant === "zone" ? "divide-white/10" : "divide-slate-200"

  return (
    <div
      aria-label="SpeakEasy release status"
      className={`flex flex-col items-center justify-center gap-2 text-xs sm:flex-row sm:gap-0 sm:divide-x ${dividerColor} ${textColor} ${className}`}
    >
      {items.map((item) => {
        const content = (
          <>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />
            <span className={labelColor}>{item.label}</span>
            <span aria-hidden="true">·</span>
            <span>{item.value}</span>
          </>
        )

        return item.href ? (
          <a
            key={item.label}
            href={item.href}
            title={item.title}
            className="flex items-center gap-1.5 px-3 transition-colors hover:text-amber-300"
          >
            {content}
          </a>
        ) : (
          <span key={item.label} title={item.title} className="flex items-center gap-1.5 px-3">
            {content}
          </span>
        )
      })}
    </div>
  )
}
