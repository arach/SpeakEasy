import type { Metadata } from "next"
import { MockPage } from "@/lib/mock-page"

export const metadata: Metadata = {
  title: "The Pad — SpeakEasy",
  description:
    "An iPad app with nine lanes, each holding whatever you put on it. Hold a lane to talk to that Codex task on your Mac.",
}

export default function CodexPage() {
  return <MockPage file="pad.html" />
}
