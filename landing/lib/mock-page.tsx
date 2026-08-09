import { readFileSync } from "fs"
import { join } from "path"

/** Renders a standalone design mock as a real page.
 *
 *  The mocks in landing/mocks are complete HTML documents — their own reset,
 *  their own type scale, their own behaviour. Promoting one means dropping it
 *  into the root layout intact rather than re-implementing it in components,
 *  so what ships is byte-for-byte the design that was signed off.
 *
 *  The document is split rather than injected whole because <html> and <head>
 *  already belong to the root layout: the style block moves into the page, the
 *  body markup becomes the page content, and the script is re-emitted as a real
 *  <script> so it still runs (markup set through dangerouslySetInnerHTML does
 *  not execute). */
interface MockDocument {
  style: string
  body: string
  script: string
  /** attributes carried on <html>, e.g. data-theme="porcelain" */
  htmlAttrs: Record<string, string>
}

function parseMock(file: string): MockDocument {
  const html = readFileSync(join(process.cwd(), "mocks", file), "utf8")

  const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n")
  const script = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join("\n")

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const body = (bodyMatch ? bodyMatch[1] : html)
    .replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim()

  const htmlAttrs: Record<string, string> = {}
  const openTag = html.match(/<html([^>]*)>/i)
  if (openTag) {
    for (const attr of openTag[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      if (attr[1] !== "lang") htmlAttrs[attr[1]] = attr[2]
    }
  }

  return { style, body, script, htmlAttrs }
}

export function MockPage({ file }: { file: string }) {
  const { style, body, script, htmlAttrs } = parseMock(file)

  // The mock styles key off attributes on <html> (theme and finish), which the
  // root layout owns — set them before first paint so nothing flashes unthemed.
  const bootstrap = Object.entries(htmlAttrs)
    .map(([k, v]) => `document.documentElement.setAttribute(${JSON.stringify(k)},${JSON.stringify(v)});`)
    .join("")

  return (
    <>
      {bootstrap ? <script dangerouslySetInnerHTML={{ __html: bootstrap }} /> : null}
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
      {script ? <script dangerouslySetInnerHTML={{ __html: script }} /> : null}
    </>
  )
}
