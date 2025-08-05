import type React from "react"
import type { Metadata } from "next"
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
  title: "SpeakEasy — Unified Text-to-Speech Library",
  description: "Simple, unified text-to-speech for all your projects. Multiple providers, smart caching, volume control.",
  keywords: "text-to-speech, tts, npm, library, openai, elevenlabs, typescript, speech synthesis",
  authors: [{ name: "SpeakEasy" }],
  openGraph: {
    title: "SpeakEasy — Unified Text-to-Speech Library",
    description: "Simple, unified text-to-speech for all your projects. Multiple providers, smart caching, volume control.",
    type: "website",
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
      <body className="font-text antialiased">{children}</body>
    </html>
  )
}
