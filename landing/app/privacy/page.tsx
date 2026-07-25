import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy - SpeakEasy",
  description: "How SpeakEasy handles text, audio, provider credentials, and website analytics.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="SpeakEasy is a local-first text-to-speech tool. This policy describes the data the app and plugin use to create and play speech."
      updated="July 24, 2026"
    >
      <section>
        <h2>What SpeakEasy processes</h2>
        <p>
          SpeakEasy processes the text you choose to narrate, audio generated from that text, player
          state, and local configuration such as your preferred provider and voice. Its playback queue,
          cache, and history are stored on your Mac.
        </p>
      </section>

      <section>
        <h2>Speech providers</h2>
        <p>
          The macOS system voice runs on your device. If you select OpenAI, ElevenLabs, Groq, or
          Gemini, SpeakEasy sends the requested text and provider settings directly to that provider
          so it can generate audio. The provider&apos;s privacy policy and terms govern that processing.
        </p>
      </section>

      <section>
        <h2>Credentials and local files</h2>
        <p>
          Provider credentials and settings are read from your environment or from SpeakEasy&apos;s local
          configuration on your Mac. SpeakEasy does not send those credentials to Arach. Treat your
          local configuration as sensitive and protect access to your user account and files.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          Arach does not retain your narration text, generated audio, queue, history, or provider
          credentials on an Arach server. Local settings remain in <code>~/.config/speakeasy</code>
          until you edit or remove them. Cached audio remains until its configured time-to-live or
          size policy removes it, or until you clear it manually. Local narration history remains
          until you remove it. Audio files saved to a path you selected remain until you delete them.
        </p>
        <p>
          You can clear the CLI cache with <code>speakeasy --clear-cache</code>, remove local history
          or settings from the SpeakEasy configuration directory, and uninstall the plugin or app.
          Removing a cloud-provider credential from SpeakEasy does not revoke it; revoke the key in
          the provider&apos;s account settings when needed.
        </p>
      </section>

      <section>
        <h2>Collection by SpeakEasy</h2>
        <p>
          The SpeakEasy app, CLI, and plugin do not operate an Arach account service and do not send
          narration text, generated audio, queue contents, or provider credentials to Arach. App
          installation checks GitHub Releases to download the signed macOS application.
        </p>
      </section>

      <section>
        <h2>Website analytics</h2>
        <p>
          The SpeakEasy website uses Google Analytics to understand aggregate site usage. Google may
          receive device, browser, approximate location, and interaction information under Google&apos;s
          own policies and the site&apos;s Google Analytics retention configuration. This website
          analytics does not include narration content and is separate from narration performed by
          the app, CLI, or plugin. Browser privacy controls or content blockers can prevent this
          analytics collection.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Use the macOS system provider to keep speech synthesis on-device.</li>
          <li>Remove cached audio, history, or configuration from your local SpeakEasy directories.</li>
          <li>Revoke provider credentials with the provider that issued them.</li>
          <li>Uninstall the plugin or macOS app at any time.</li>
        </ul>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          For privacy questions, open an issue in the{" "}
          <a href="https://github.com/arach/SpeakEasy/issues">SpeakEasy issue tracker</a>.
        </p>
      </section>
    </LegalPage>
  )
}
