import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
  weight: ["300", "400", "700", "900"],
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
    <html lang="en" className={lato.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
