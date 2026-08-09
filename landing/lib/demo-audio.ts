import demoAudio from "./demo-audio.json"

/**
 * Single source of truth for the hero demo clip.
 *
 * `spokenText` is not marketing copy — it is a transcript. It must match what
 * `tagline-demo.mp3` actually says, because the asset is pre-rendered and
 * committed rather than synthesized at build time.
 *
 * To change the line, edit demo-audio.json and regenerate the asset in the
 * same commit, otherwise the transcript and the audio drift apart:
 *
 *   OPENAI_API_KEY=... node generate-tagline-audio.js
 *
 * generate-tagline-audio.js reads the same JSON file, so the script and the
 * page cannot disagree about what is being spoken.
 */
export const taglineDemo: { src: string; spokenText: string } = demoAudio
