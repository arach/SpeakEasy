import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service - SpeakEasy",
  description: "Terms for using the SpeakEasy app, CLI, plugin, and website.",
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="These terms apply to your use of the SpeakEasy app, command-line tools, plugin, website, and related downloads."
      updated="July 24, 2026"
    >
      <section>
        <h2>Using SpeakEasy</h2>
        <p>
          You may use, copy, modify, and distribute the open-source SpeakEasy software under its MIT
          License. You are responsible for using SpeakEasy lawfully and for having the rights needed
          to process, narrate, save, or share the text and audio you provide.
        </p>
      </section>

      <section>
        <h2>Third-party services and costs</h2>
        <p>
          Optional speech providers, GitHub, Codex, ChatGPT, and other third-party services have their
          own terms and privacy policies. You are responsible for provider accounts, API credentials,
          usage charges, quotas, and compliance with those services. SpeakEasy does not guarantee the
          availability or output of a third-party service.
        </p>
      </section>

      <section>
        <h2>Audio and generated output</h2>
        <p>
          Speech output may contain errors, omissions, unexpected pronunciation, or content that does
          not match the source text. Review output before relying on it or sharing it, especially for
          medical, legal, financial, safety-critical, or accessibility uses.
        </p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          SpeakEasy is provided “as is,” without warranties of any kind, to the maximum extent
          permitted by law. The full warranty disclaimer and limitation of liability are set out in
          the MIT License distributed with the software.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          These terms may be updated as SpeakEasy changes. The date above identifies the current
          version. Continued use after an update means you accept the revised terms.
        </p>
      </section>

      <section>
        <h2>Support</h2>
        <p>
          Questions and support requests can be filed in the{" "}
          <a href="https://github.com/arach/SpeakEasy/issues">SpeakEasy issue tracker</a>.
        </p>
      </section>
    </LegalPage>
  )
}
