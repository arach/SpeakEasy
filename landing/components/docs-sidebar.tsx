import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ExternalLink } from "lucide-react"
import { docHref, type DocNavItem } from "@/lib/docs"

export default function DocsSidebar({
  items,
  activeSlug,
}: {
  items: DocNavItem[]
  activeSlug?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm">
      <div className="p-3 border-b border-slate-200/60">
        <h3 className="font-semibold text-sm text-slate-900">Documentation</h3>
      </div>
      <ScrollArea className="h-96">
        <div className="p-2 space-y-3">
          {items.map((item, index) => {
            if (item.type === "separator") {
              return (
                <div
                  key={`${item.title}-${index}`}
                  className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  {item.title}
                </div>
              )
            }

            const isActive = item.slug === activeSlug
            return (
              <Link
                key={item.slug}
                href={docHref(item.slug)}
                className={`block px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-900 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {item.title}
              </Link>
            )
          })}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-slate-200/60">
        <div className="space-y-1">
          <Link
            href="https://github.com/arach/SpeakEasy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900"
          >
            <ExternalLink className="w-3 h-3" />
            GitHub
          </Link>
          <Link
            href="https://www.npmjs.com/package/@arach/speakeasy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900"
          >
            <ExternalLink className="w-3 h-3" />
            NPM Package
          </Link>
        </div>
      </div>
    </div>
  )
}