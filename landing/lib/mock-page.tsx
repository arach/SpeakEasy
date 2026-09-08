import { readFileSync } from "fs"
import { join } from "path"
import { releaseDownloadUrl, releasePageUrl, releaseVersion, codexInstallPrompt, testFlightUrl, iPadBetaAvailable } from "./release"
import { ApplyHtmlAttrs } from "./apply-html-attrs"

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
  const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const values: Record<string, string> = { releaseDownloadUrl, releasePageUrl, releaseVersion, codexInstallPrompt, testFlightUrl: testFlightUrl ?? "" }
  const html = readFileSync(join(process.cwd(), "mocks", file), "utf8")
    .replace(/<!-- TESTFLIGHT_(AVAILABLE|PENDING) -->([\s\S]*?)<!-- \/TESTFLIGHT_\1 -->/g, (_, state: string, content: string) => (state === "AVAILABLE") === iPadBetaAvailable ? content : "")
    .replace(/\{\{(releaseDownloadUrl|releasePageUrl|releaseVersion|codexInstallPrompt|testFlightUrl)\}\}/g, (_, key: string) => escapeHtml(values[key]))

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
      // <html> belongs to the root layout. Never copy lang, and never stamp
      // interactive attrs onto it before hydrate — that mismatches the server tree.
      if (attr[1] === "lang" || attr[1] === "data-view") continue
      htmlAttrs[attr[1]] = attr[2]
    }
  }

  return { style, body, script, htmlAttrs }
}

export function MockPage({ file }: { file: string }) {
  const { style, body, script, htmlAttrs } = parseMock(file)

  return (
    <>
      {Object.keys(htmlAttrs).length > 0 ? <ApplyHtmlAttrs attrs={htmlAttrs} /> : null}
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: body }} />
      {script ? <script dangerouslySetInnerHTML={{ __html: script }} /> : null}
    </>
  )
}
