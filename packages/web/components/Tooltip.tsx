"use client";

import { useState, type ReactNode } from "react";

/**
 * Minimal tooltip — appears on hover/focus, keyboard-accessible.
 * No portal (fits within parent z-stack).
 */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 border border-[--color-border] bg-white px-3 py-2 text-[11px] leading-relaxed text-[--color-text] shadow-md ${
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/**
 * Help icon with tooltip. Use anywhere a term needs explanation.
 */
export function HelpHint({ content }: { content: string }) {
  return (
    <Tooltip content={content}>
      <span className="material-symbols-outlined text-sm text-[--color-text-muted] transition-colors hover:text-[--color-primary]">
        help
      </span>
    </Tooltip>
  );
}
