export const releaseVersion = "0.2.19"
export const launchVersion = "0.2.19"

const releaseRoot = `https://github.com/arach/SpeakEasy/releases/download/v${releaseVersion}`

export const releasePageUrl = `https://github.com/arach/SpeakEasy/releases/tag/v${releaseVersion}`
export const releaseDownloadUrl =
  process.env.NEXT_PUBLIC_SPEAKEASY_DOWNLOAD_URL ?? `${releaseRoot}/SpeakEasy.dmg`
export const releaseChecksumUrl = `${releaseRoot}/SpeakEasy-${releaseVersion}.sha256`
export const releaseInstallerUrl = `${releaseRoot}/install-speakeasy.sh`

export const codexInstallPrompt = `Install SpeakEasy ${releaseVersion} on this Mac. Download and inspect ${releaseInstallerUrl}, then run it. Do not build from source or bypass Gatekeeper. Use the installer’s checksum, Developer ID, notarization, and exact-version checks. When SpeakEasy opens Settings → Deck, tell me which human-only permissions or setup steps remain.`

export const releaseRequirements = {
  platform: "Apple silicon",
  os: "macOS 14 or newer",
} as const
