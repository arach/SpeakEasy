/**
 * postinstall — materialize the local file: dependencies.
 *
 * bun installs `file:` packages as directories of per-file symlinks into the
 * sibling repos. Turbopack (Next 16) refuses to parse a package.json that is
 * a symlink ("a redirect can't be parsed as json"), so after each install we
 * replace the symlink farms under node_modules with real, dereferenced copies
 * of the sibling package sources.
 */
import { cpSync, rmSync } from "node:fs";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const nodeModules = path.join(appRoot, "node_modules");

const LOCAL_PACKAGES = [
  ["studio", "/Users/arach/dev/studio"],
  ["hudsonkit", "/Users/arach/dev/hudson/packages/web/hudsonkit"],
];

const SKIP = new Set([
  "node_modules",
  ".git",
  ".next",
  "examples",
  "__tests__",
  ".openscout",
]);

for (const [name, source] of LOCAL_PACKAGES) {
  const dest = path.join(nodeModules, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(source, dest, {
    recursive: true,
    dereference: true,
    filter: (src) => !SKIP.has(path.basename(src)) && !src.endsWith(".tgz"),
  });
  console.log(`materialized ${name} <- ${source}`);
}
