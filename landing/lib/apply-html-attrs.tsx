"use client"

import { useEffect } from "react"

/** Apply mock <html> attributes after hydrate.
 *
 *  The root layout owns <html>. Writing those attributes from a blocking
 *  script before React hydrates (data-theme, etc.) makes the client tree
 *  disagree with the server and trips a hydration warning. Porcelain is
 *  already the :root default, so the one-frame delay is invisible. */
export function ApplyHtmlAttrs({ attrs }: { attrs: Record<string, string> }) {
  const signature = JSON.stringify(attrs)
  useEffect(() => {
    const next = JSON.parse(signature) as Record<string, string>
    const root = document.documentElement
    const previous = Object.keys(next).map((key) => [key, root.getAttribute(key)] as const)
    for (const [key, value] of Object.entries(next)) root.setAttribute(key, value)
    return () => {
      for (const [key, value] of previous) {
        if (value === null) root.removeAttribute(key)
        else root.setAttribute(key, value)
      }
    }
  }, [signature])
  return null
}
