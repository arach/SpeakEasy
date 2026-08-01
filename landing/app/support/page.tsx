import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Support - SpeakEasy",
  description: "Get help with SpeakEasy installation, playback, providers, and the Codex plugin.",
}

export default function SupportPage() {
  return (
    <LegalPage
      title="SpeakEasy Support"
      summary="Start with local diagnostics, then send a focused issue if SpeakEasy still needs attention."
      updated="July 24, 2026"
    >
      <section>
        <h2>Quick checks</h2>
        <ul>
          <li>Run <code>speakeasy --doctor</code> to check the CLI and provider configuration.</li>
          <li>Open SpeakEasy from Applications and confirm the tumbler icon appears in the menu bar.</li>
          <li>Use the macOS system voice to separate app issues from provider account issues.</li>
          <li>Confirm network access and account quota when using a cloud speech provider.</li>
        </ul>
      </section>

      <section>
        <h2>Documentation</h2>
        <p>
          Read the <a href="/docs/">SpeakEasy documentation</a> for installation, configuration, CLI,
          and troubleshooting guidance.
        </p>
      </section>

      <section>
        <h2>Report an issue</h2>
        <p>
          Search or open an issue in the{" "}
          <a href="https://github.com/arach/SpeakEasy/issues">SpeakEasy issue tracker</a>. Include your
          macOS version, SpeakEasy version, the provider you selected, the command or prompt that
          failed, and non-secret diagnostic output. Never include API keys.
        </p>
      </section>
    </LegalPage>
  )
}
