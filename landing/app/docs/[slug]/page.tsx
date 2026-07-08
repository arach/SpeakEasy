import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import DocsMarkdown from "@/components/docs-markdown"
import DocsSidebar from "@/components/docs-sidebar"
import {
  getAllDocSlugs,
  getDocNavTree,
  getDocNavigation,
  loadDocPage,
  resolveSlug,
} from "@/lib/docs"
import { getPackageVersion } from "@/lib/package-version"

interface DocPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params
  const page = await loadDocPage(slug)

  if (!page) {
    return { title: "Page Not Found - SpeakEasy Docs" }
  }

  return {
    title: `${page.title} - SpeakEasy Documentation`,
    description: page.description,
  }
}

export async function generateStaticParams() {
  const slugs = await getAllDocSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params
  const page = await loadDocPage(slug)
  const navItems = await getDocNavTree()
  const version = await getPackageVersion()

  if (!page) {
    notFound()
  }

  const { prev, next } = await getDocNavigation(slug)
  const activeSlug = resolveSlug(slug)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                ← Back to Home
              </Link>
              <div className="h-4 w-px bg-slate-300" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">{page.title}</h1>
                {page.description ? (
                  <p className="text-xs text-slate-600">{page.description}</p>
                ) : null}
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              v{version}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <DocsSidebar items={navItems} activeSlug={activeSlug} />
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm">
              <div className="px-8 py-10">
                <DocsMarkdown content={page.content} />

                <div className="mt-12 pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      {prev ? (
                        <Link href={`/docs/${prev.slug}`}>
                          <Button variant="outline" size="sm" className="group">
                            <ChevronLeft className="w-3 h-3 mr-1 group-hover:-translate-x-1 transition-transform" />
                            <div className="text-left">
                              <div className="text-xs text-slate-500">Previous</div>
                              <div className="font-medium text-xs">{prev.title}</div>
                            </div>
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex-1 text-right">
                      {next ? (
                        <Link href={`/docs/${next.slug}`}>
                          <Button variant="outline" size="sm" className="group">
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Next</div>
                              <div className="font-medium text-xs">{next.title}</div>
                            </div>
                            <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}