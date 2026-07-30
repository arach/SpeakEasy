import type { Metadata } from "next";
import { getHudsonThemeScript } from "hudsonkit/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpeakEasy Studio",
  description:
    "Design studio for SpeakEasy — the deck control surface, its embedding contract, and the path to a connected Pad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getHudsonThemeScript({
              storageKey: "speakeasy.studio.theme",
              defaultTheme: "dark",
              defaultTemplate: "hudson",
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
