import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tradi-Nox — Confidential OTC Desk",
  description:
    "On-chain OTC with hidden amounts and Vickrey-fair RFQ pricing, built on iExec Nox.",
  openGraph: {
    title: "Tradi-Nox — Confidential OTC Desk",
    description: "Your trade. Their guess. Nobody knows.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tradi-Nox — Confidential OTC Desk",
    description: "Your trade. Their guess. Nobody knows.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
