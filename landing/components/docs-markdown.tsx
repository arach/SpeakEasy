import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import { CodeBlock } from "@/components/code-block"
import { HeadingLink } from "@/components/heading-link"
function resolveDocHref(href?: string) {
  if (!href || href.startsWith("http") || href.startsWith("#")) return href

  const withoutExt = href.replace(/\.(mdx?|md)$/, "")
  if (withoutExt.startsWith("/docs/")) return withoutExt
  if (withoutExt.startsWith("/")) return `/docs${withoutExt}`
  return `/docs/${withoutExt}`
}

export default function DocsMarkdown({ content }: { content: string }) {
  return (
    <div
      className="prose prose-slate prose-sm max-w-none 
        prose-headings:scroll-m-20 prose-headings:font-display
        prose-h1:text-2xl prose-h1:font-light prose-h1:text-slate-900 prose-h1:mb-4 prose-h1:mt-5 prose-h1:leading-tight
        prose-h2:text-lg prose-h2:font-medium prose-h2:text-slate-800 prose-h2:mb-3 prose-h2:mt-5 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2
        prose-h3:text-base prose-h3:font-medium prose-h3:text-slate-700 prose-h3:mb-2 prose-h3:mt-4
        prose-h4:text-sm prose-h4:font-medium prose-h4:text-slate-600 prose-h4:mb-2 prose-h4:mt-3
        prose-p:text-sm prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-3 prose-p:font-text
        prose-strong:text-slate-800 prose-strong:font-semibold
        prose-ul:space-y-1 prose-li:text-sm prose-li:text-slate-600
        prose-code:bg-slate-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-code:text-slate-800
        prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:rounded-xl prose-pre:p-3 prose-pre:overflow-x-auto
        prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:pl-3 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-sm prose-blockquote:text-slate-700
        prose-table:text-sm prose-table:border-collapse
        prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:text-blue-700 hover:prose-a:underline
        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          h1: ({ id, ...props }) => (
            <h1
              id={id}
              className="text-2xl font-display font-light text-slate-900 mb-4 mt-5 leading-tight first:mt-0"
              {...props}
            />
          ),
          h2: ({ id, children, ...props }) => (
            <h2
              id={id}
              className="group text-lg font-display font-medium text-slate-800 mb-3 mt-5 border-b border-slate-200 pb-2 flex items-center gap-2"
              {...props}
            >
              {children}
              {id && <HeadingLink id={id} size="lg" />}
            </h2>
          ),
          h3: ({ id, children, ...props }) => (
            <h3
              id={id}
              className="group text-base font-display font-medium text-slate-700 mb-2 mt-4 flex items-center gap-2"
              {...props}
            >
              {children}
              {id && <HeadingLink id={id} size="md" />}
            </h3>
          ),
          h4: ({ id, children, ...props }) => (
            <h4
              id={id}
              className="group text-sm font-display font-medium text-slate-600 mb-2 mt-3 flex items-center gap-2"
              {...props}
            >
              {children}
              {id && <HeadingLink id={id} size="sm" />}
            </h4>
          ),
          p: (props) => (
            <p className="text-sm text-slate-600 leading-relaxed mb-3 font-text" {...props} />
          ),
          ul: (props) => <ul className="space-y-1 text-sm text-slate-600 mb-3" {...props} />,
          li: (props) => <li className="leading-relaxed text-sm" {...props} />,
          pre: (props) => {
            const child = props.children as { props?: { className?: string; children?: string } }
            const code = child?.props
            if (code?.className?.includes("language-")) {
              return <CodeBlock className={code.className} children={code.children} />
            }
            return (
              <pre
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-x-auto mb-4 text-xs"
                {...props}
              />
            )
          },
          code: (props) => {
            const { className, children, ...otherProps } = props
            const isInline = !className?.includes("language-")
            if (isInline) {
              return <CodeBlock inline className={className} children={children} />
            }
            return (
              <code className={className} {...otherProps}>
                {children}
              </code>
            )
          },
          table: (props) => (
            <div className="overflow-x-auto mb-4">
              <table
                className="min-w-full border-collapse border border-slate-200 rounded-lg overflow-hidden text-sm"
                {...props}
              />
            </div>
          ),
          th: (props) => (
            <th
              className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-xs text-slate-700 font-text"
              {...props}
            />
          ),
          td: (props) => (
            <td className="border border-slate-200 px-3 py-2 text-xs text-slate-600" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="border-l-4 border-blue-500 bg-blue-50/50 pl-3 py-2 mb-3 italic text-sm text-slate-700"
              {...props}
            />
          ),
          a: ({ href, children, ...otherProps }) => {
            const processedHref = resolveDocHref(href)
            const isExternal = href?.startsWith("http")
            return (
              <a
                href={processedHref}
                className={`text-blue-600 font-medium no-underline hover:text-blue-700 hover:underline ${
                  isExternal ? 'after:content-["↗"] after:ml-1 after:text-xs' : ""
                }`}
                {...(isExternal && {
                  target: "_blank",
                  rel: "noopener noreferrer",
                })}
                {...otherProps}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}