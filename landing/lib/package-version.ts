import { getSpeakeasyVersion } from "@/lib/site"

export async function getPackageVersion(): Promise<string> {
  return getSpeakeasyVersion()
}