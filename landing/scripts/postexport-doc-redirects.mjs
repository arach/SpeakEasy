/**
 * GitHub Pages serves folder indexes at /docs/slug/ but Next.js client
 * navigation to /docs/slug (no slash) 404s on static export. Write .html
 * stubs that redirect extensionless URLs to the trailing-slash canonical path.
 */
import { readFile, writeFile, readdir } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DOCS = join(__dirname, "..", "out", "docs")
const META_PATH = join(__dirname, "..", "..", "docs", "meta.json")

function redirectHtml(target) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${target}">
  <script>location.replace("${target}")</script>
  <title>Redirecting…</title>
</head>
<body>
  <p><a href="${target}">Continue to documentation</a></p>
</body>
</html>
`
}

async function main() {
  const meta = JSON.parse(await readFile(META_PATH, "utf8"))
  const slugs = meta.pages.filter((entry) => !entry.startsWith("---"))

  for (const slug of slugs) {
    const canonical = slug === "index" ? "/docs/" : `/docs/${slug}/`
    await writeFile(join(OUT_DOCS, `${slug}.html`), redirectHtml(canonical), "utf8")
  }

  // Also stub any exported doc folders not listed in meta (e.g. legacy aliases)
  const entries = await readdir(OUT_DOCS, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "_next") continue
    const htmlPath = join(OUT_DOCS, `${entry.name}.html`)
    try {
      await readFile(htmlPath)
    } catch {
      const canonical = entry.name === "index" ? "/docs/" : `/docs/${entry.name}/`
      await writeFile(htmlPath, redirectHtml(canonical), "utf8")
    }
  }

  console.log(`Wrote doc redirect stubs for ${slugs.length} pages`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})