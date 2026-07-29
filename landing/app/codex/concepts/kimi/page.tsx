import type { Metadata } from "next"
import KimiConceptStudy from "./study"

export const metadata: Metadata = {
  title: "Codex visual concepts · Kimi",
  description:
    "Three independent visual studies for SpeakEasy’s Codex story: Speak to Codex. Hear it answer.",
}

export default function KimiConceptPage() {
  return <KimiConceptStudy />
}
