export const SPEAKEASY_PROVIDERS = [
  "System",
  "OpenAI",
  "ElevenLabs",
  "Groq",
  "Gemini",
] as const

export const SPEAKEASY_PROVIDER_COUNT = SPEAKEASY_PROVIDERS.length

export const SPEAKEASY_PROVIDER_SUMMARY =
  "System voices, OpenAI, ElevenLabs, Groq, and Gemini"

export function getSpeakeasyVersion(): string {
  return process.env.NEXT_PUBLIC_SPEAKEASY_VERSION ?? "0.0.0"
}