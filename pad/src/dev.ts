import { extname, resolve } from "node:path";
import { buildPad } from "../scripts/build.ts";

await buildPad();

const dist = resolve(import.meta.dir, "../dist");
const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const server = Bun.serve({
  port: Number(process.env.PORT ?? 43210),
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const candidate = resolve(dist, `.${path}`);
    const file = Bun.file(candidate);
    if (await file.exists()) {
      return new Response(file, { headers: { "content-type": types[extname(candidate)] ?? "application/octet-stream", "cache-control": "no-store" } });
    }
    if (!extname(path)) return new Response(Bun.file(resolve(dist, "index.html")), { headers: { "content-type": types[".html"], "cache-control": "no-store" } });
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Deck running at http://localhost:${server.port}`);
