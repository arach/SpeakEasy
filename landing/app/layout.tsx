import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { Inter, Silkscreen } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

// Fallback fonts that closely match SF Pro
const sfProDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
})

const sfProText = Inter({
  subsets: ["latin"],
  variable: "--font-text",
  weight: ["300", "400", "500", "600"],
  display: "swap",
})

const silkscreen = Silkscreen({
  subsets: ["latin"],
  variable: "--font-silkscreen",
  weight: ["400"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "SpeakEasy — Voice for Your Agents",
  description: "Text-to-speech for agents, apps, and automations—with a native macOS player, live transcript HUD, smart caching, and multiple providers.",
  keywords: "text-to-speech, tts, AI agents, Codex, macOS menu bar, npm, openai, elevenlabs, typescript, speech synthesis",
  authors: [{ name: "SpeakEasy" }],
  metadataBase: new URL("https://speakeasy.arach.dev"),
  openGraph: {
    title: "SpeakEasy — Voice for Your Agents",
    description: "Text-to-speech for agents, apps, and automations—with a native macOS player and live transcript HUD.",
    type: "website",
    url: "https://speakeasy.arach.dev",
    siteName: "SpeakEasy",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SpeakEasy — Voice for your agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SpeakEasy — Voice for Your Agents",
    description: "Text-to-speech for agents, apps, and automations—with a native macOS player and live transcript HUD.",
    images: ["/og-image.png"],
  },
  generator: 'SpeakEasy'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sfProDisplay.variable} ${sfProText.variable} ${silkscreen.variable}`}>
      <body className="font-text antialiased">
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GSHDZPFRZG"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GSHDZPFRZG');`}
        </Script>
      </body>
    </html>
  )
}
