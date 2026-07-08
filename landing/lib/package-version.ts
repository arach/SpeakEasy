import { readFile } from "fs/promises"
import { join } from "path"

export async function getPackageVersion(): Promise<string> {
  const raw = await readFile(join(process.cwd(), "..", "package.json"), "utf8")
  return JSON.parse(raw).version as string
}