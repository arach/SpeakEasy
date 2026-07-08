import { readFile } from "fs/promises"
import { join } from "path"
import matter from "gray-matter"

const DOCS_DIR = join(process.cwd(), "..", "docs")

/** Legacy routes from the old docs setup. */
const SLUG_ALIASES: Record<string, string> = {
  overview: "index",
}

export interface DocPage {
  slug: string
  title: string
  description: string
  content: string
}

export interface DocNavSeparator {
  type: "separator"
  title: string
}

export interface DocNavPage {
  type: "page"
  slug: string
  title: string
  description: string
}

export type DocNavItem = DocNavSeparator | DocNavPage

export function resolveSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug
}

export async function loadDocsMeta(): Promise<{ title: string; pages: string[] }> {
  const raw = await readFile(join(DOCS_DIR, "meta.json"), "utf8")
  return JSON.parse(raw)
}

export function listDocSlugs(pages: string[]): string[] {
  return pages.filter((entry) => !entry.startsWith("---"))
}

export async function loadDocPage(slug: string): Promise<DocPage | null> {
  const resolved = resolveSlug(slug)
  try {
    const raw = await readFile(join(DOCS_DIR, `${resolved}.mdx`), "utf8")
    const { data, content } = matter(raw)
    return {
      slug: resolved,
      title: (data.title as string) ?? resolved,
      description: (data.description as string) ?? "",
      content: content.trim(),
    }
  } catch {
    return null
  }
}

export async function getAllDocSlugs(): Promise<string[]> {
  const meta = await loadDocsMeta()
  const slugs = listDocSlugs(meta.pages)
  return [...slugs, ...Object.keys(SLUG_ALIASES)]
}

export async function getDocNavigation(currentSlug: string) {
  const meta = await loadDocsMeta()
  const slugs = listDocSlugs(meta.pages)
  const resolved = resolveSlug(currentSlug)
  const currentIndex = slugs.indexOf(resolved)
  if (currentIndex === -1) return { prev: null, next: null }

  const prevSlug = currentIndex > 0 ? slugs[currentIndex - 1] : null
  const nextSlug = currentIndex < slugs.length - 1 ? slugs[currentIndex + 1] : null

  const [prev, next] = await Promise.all([
    prevSlug ? loadDocPage(prevSlug) : Promise.resolve(null),
    nextSlug ? loadDocPage(nextSlug) : Promise.resolve(null),
  ])

  return { prev, next }
}

export async function getDocNavTree(): Promise<DocNavItem[]> {
  const meta = await loadDocsMeta()
  const items: DocNavItem[] = []

  for (const entry of meta.pages) {
    if (entry.startsWith("---") && entry.endsWith("---")) {
      items.push({
        type: "separator",
        title: entry.slice(3, -3).trim(),
      })
      continue
    }

    const page = await loadDocPage(entry)
    if (!page) continue

    items.push({
      type: "page",
      slug: page.slug,
      title: page.title,
      description: page.description,
    })
  }

  return items
}

export function groupDocNavPages(items: DocNavItem[]) {
  const groups: { title: string; pages: DocNavPage[] }[] = []
  let current = { title: "Documentation", pages: [] as DocNavPage[] }

  for (const item of items) {
    if (item.type === "separator") {
      if (current.pages.length > 0) groups.push(current)
      current = { title: item.title, pages: [] }
      continue
    }
    current.pages.push(item)
  }

  if (current.pages.length > 0) groups.push(current)
  return groups
}