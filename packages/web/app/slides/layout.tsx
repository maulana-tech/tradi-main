import type { Metadata } from "next";

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
    <div className="fixed inset-0 z-40 bg-[--color-bg]">{children}</div>
  );
}
