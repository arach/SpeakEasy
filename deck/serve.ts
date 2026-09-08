// Static server for the deck and its template catalog.
// bun run deck/serve.ts  →  http://localhost:43211
const port = Number(process.env.PORT ?? 43211);

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(new URL(`.${path}`, import.meta.url));
    if (await file.exists()) {
      const ext = path.slice(path.lastIndexOf("."));
      return new Response(file, {
        headers: { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-store" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Deck at http://localhost:${port}`);
