#!/usr/bin/env bun

import { accessSync, constants } from "node:fs";
import { join } from "node:path";

export function speakeasyCommand(args: string[]): string[] {
  const bundledRuntime = join(import.meta.dir, "..", "runtime", "speakeasy-cli.js");
  try {
    accessSync(bundledRuntime, constants.R_OK);
    return ["bun", bundledRuntime, ...args];
  } catch {}

  throw new Error(`SpeakEasy runtime is missing at ${bundledRuntime}`);
}

if (import.meta.main) {
  try {
    const child = Bun.spawn(speakeasyCommand(Bun.argv.slice(2)), {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    process.exit(await child.exited);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
