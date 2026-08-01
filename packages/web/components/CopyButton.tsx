"use client";

import { useState } from "react";
import { useToast } from "./Toast";

export function CopyButton({
  value,
  label,
  size = "sm",
}: {
  value: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(`Copied ${label ?? value.slice(0, 14) + "…"}`);
    } catch {
      toast.error("Clipboard access denied");
    }
  }

  const iconSize = size === "sm" ? "text-sm" : "text-base";

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label ?? value.slice(0, 14)}…`}
      className={`inline-flex items-center gap-1 text-[--color-text-muted] transition-colors hover:text-[--color-primary] ${
        copied ? "text-[--color-primary]" : ""
      }`}
    >
      <span className={`material-symbols-outlined ${iconSize}`}>
        {copied ? "check_circle" : "content_copy"}
      </span>
      {label && (
        <span className="text-xs">{copied ? "Copied" : label}</span>
      )}
    </button>
  );
}
