import type { Metadata } from "next";
import { Lato } from "next/font/google";

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Tradi-Nox — Pitch Deck",
  description:
    "Confidential OTC desk on iExec Nox. 10-slide pitch for the iExec Vibe Coding Challenge.",
};

/**
 * Slides layout strips the global Header/Footer and locks the viewport so
 * each slide fills the screen. The root <body> already carries the global
 * overlay — we only need to make sure slides sit on top of it.
 */
export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${lato.variable} slides-theme fixed inset-0 z-40 bg-[--color-bg]`}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      />
      {children}
    </div>
  );
}
