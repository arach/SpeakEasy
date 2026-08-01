import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "dist");

export async function buildPad(): Promise<void> {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [resolve(root, "src/app.ts")],
    outdir,
    target: "browser",
    naming: "app.[ext]",
    minify: true,
    sourcemap: "none",
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("SpeakEasy Pad bundle failed.");
  }

  await Bun.write(resolve(outdir, "index.html"), Bun.file(resolve(root, "index.html")));
  await cp(resolve(root, "public"), outdir, { recursive: true });
  console.log(`SpeakEasy Pad built at ${outdir}`);
}

if (import.meta.main) await buildPad();
