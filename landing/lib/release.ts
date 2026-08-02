export const releaseVersion = "0.2.18"

const releaseRoot = `https://github.com/arach/SpeakEasy/releases/download/v${releaseVersion}`

export const releasePageUrl = `https://github.com/arach/SpeakEasy/releases/tag/v${releaseVersion}`
export const releaseDownloadUrl =
  process.env.NEXT_PUBLIC_SPEAKEASY_DOWNLOAD_URL ?? `${releaseRoot}/SpeakEasy.dmg`
export const releaseChecksumUrl = `${releaseRoot}/SpeakEasy-${releaseVersion}.sha256`

export const releaseRequirements = {
  platform: "Apple silicon",
  os: "macOS 14 or newer",
} as const
