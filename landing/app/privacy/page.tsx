import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy - SpeakEasy",
  description: "How SpeakEasy handles microphone capture, transcription, narration, provider credentials, and website analytics.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="SpeakEasy is a local-network voice companion and text-to-speech tool. This policy describes how its Mac, browser, and iPad surfaces handle microphone audio, transcripts, narration, and credentials."
      updated="August 10, 2026"
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
        <h2>Microphone capture and transcription</h2>
        <p>
          SpeakEasy opens a microphone only after you explicitly start a voice turn and stops when
          you finish or cancel it. A voice turn can begin on the Mac, in the paired browser Deck, or
          in the native iPad developer preview.
        </p>
        <p>
          On the Mac, SpeakEasy prefers its bundled Parakeet model, which performs transcription on
          that Mac. It can use Apple Speech while Parakeet warms or as a fallback. SpeakEasy requests
          on-device Apple recognition when the operating system reports support; otherwise Apple&apos;s
          handling is governed by the Mac&apos;s capabilities, settings, and Apple&apos;s privacy terms.
          Audio is not sent to Arach.
        </p>
        <p>
          The browser Deck records on the browser device, then sends a bounded audio file over the
          paired local-network HTTPS connection to the selected Mac. The native iPad shell first
          tries Apple Speech; Apple&apos;s handling of that request is governed by the device&apos;s
          capabilities, settings, and Apple&apos;s privacy terms. If Apple Speech is unavailable or does
          not return a final transcript, the shell sends its fallback recording to the paired Mac
          for Parakeet transcription.
        </p>
        <p>
          Mac-side upload directories are owner-only and recordings are mode <code>0600</code>. The
          temporary upload is deleted immediately after the transcription request finishes, whether
          it succeeds or fails. The native iPad shell also deletes its temporary recording after the
          Apple Speech or Mac fallback path completes. SpeakEasy does not retain voice-turn audio as
          narration history or upload it to an Arach server.
        </p>
      </section>

      <section>
        <h2>Local-network Deck</h2>
        <p>
          The Deck connects directly to a Mac on the same local network. Paired sessions use a
          temporary secret and local HTTPS. The Deck exchanges task display state, explicit control
          commands, transcripts, narration state, and—only for device microphone turns—the bounded
          recording described above. SpeakEasy does not relay this traffic through an Arach service.
        </p>
      </section>

      <section>
        <h2>Codex tasks and transcripts</h2>
        <p>
          When you send a voice turn, SpeakEasy submits the final transcript to the exact Codex
          Desktop task you selected. The transcript, Codex response, tool activity, and task history
          remain in Codex and are governed by your Codex account, application, and retention settings.
          SpeakEasy does not create an Arach-hosted copy of that conversation.
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
          Arach does not retain your microphone audio, transcripts, narration text, generated audio,
          queue, history, or provider credentials on an Arach server. Voice-turn recordings are
          temporary and are deleted as described above. Local settings remain in
          <code>~/.config/speakeasy</code> until you edit or remove them. Cached narration audio
          remains until its configured time-to-live or size policy removes it, or until you clear it
          manually. Local narration history remains until you remove it. Audio files saved to a path
          you selected remain until you delete them.
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
          microphone audio, transcripts, narration text, generated audio, queue contents, or
          provider credentials to Arach. App installation checks GitHub Releases to download the
          signed macOS application.
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
        <h2>Pad interest list</h2>
        <p>
          If you enter your email address in the interest form on this site, that address is stored
          so Arach can contact you when the iPad Pad preview is available. The record holds your
          email address, a label for the form you used, and the two-letter country code Cloudflare
          reports for the request. It does not hold your name, IP address, user agent, or any
          tracking identifier.
        </p>
        <p>
          The list lives in a Cloudflare D1 database operated by Arach and is used only to send you
          that invitation. It is not sold, shared, or added to a marketing list. Your IP address is
          used at Cloudflare&apos;s edge to rate-limit submissions and is never stored.
        </p>
        <p>
          Ask to be removed at any time by opening an issue in the{" "}
          <a href="https://github.com/arach/SpeakEasy/issues">SpeakEasy issue tracker</a>; you do not
          need to post your address publicly to make the request. The list is deleted once the
          preview it was collected for has shipped.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Use only the Mac microphone path to keep capture and transcription on the Mac.</li>
          <li>Use the browser or iPad Deck only on a local network you trust.</li>
          <li>Use the macOS system provider to keep speech synthesis on-device.</li>
          <li>Remove cached audio, history, or configuration from your local SpeakEasy directories.</li>
          <li>Revoke provider credentials with the provider that issued them.</li>
          <li>Uninstall the plugin or macOS app at any time.</li>
          <li>Ask to be removed from the Pad interest list at any time.</li>
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
