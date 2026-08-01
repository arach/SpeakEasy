import { readFile } from "node:fs/promises";
import path from "node:path";
import { StudioApp } from "@/studio/StudioApp";

/**
 * The studio renders repo docs straight off disk — never copied into the app.
 * `process.cwd()` is `design/studio`, so the SpeakEasy repo root is two up.
 * Keys are studio page hrefs.
 */
const DOC_FILES: Record<string, string> = {
  "/studio/eng/deck-readme": "deck/README.md",
  "/studio/eng/design-layers": "docs/design/deck-design-layers.md",
  "/studio/eng/connect-brief": "docs/design/deck-connect-brief.md",
};

export const dynamic = "force-dynamic";

async function loadDocs(): Promise<Record<string, string>> {
  const root = path.resolve(process.cwd(), "..", "..");
  const docs: Record<string, string> = {};
  await Promise.all(
    Object.entries(DOC_FILES).map(async ([href, file]) => {
      try {
        docs[href] = await readFile(path.join(root, file), "utf8");
      } catch {
        docs[href] = `# ${file}\n\nCould not read \`${file}\` from the repo root.`;
      }
    }),
  );
  return docs;
}

export default async function StudioRoute() {
  const docs = await loadDocs();
  return <StudioApp docs={docs} />;
}
