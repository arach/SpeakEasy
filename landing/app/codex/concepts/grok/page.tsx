import type { Metadata } from "next"
import GrokConceptStudy from "./study"

export const metadata: Metadata = {
  title: "Codex visual concepts · Grok",
  description:
    "Three independent visual studies for SpeakEasy’s Codex story: Speak to Codex. Hear it answer.",
}

export default function GrokConceptPage() {
  return <GrokConceptStudy />
}
