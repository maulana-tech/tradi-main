"use client";

import { useState } from "react";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

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

  const iconSize = size === "sm" ? "size-4" : "size-[18px]";

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label ?? value.slice(0, 14)}`}
      title={`Copy ${label ?? value.slice(0, 14)}…`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-surface-raised)] hover:text-white ${
        copied ? "text-[var(--color-success-text)]" : ""
      }`}
    >
      <Icon name={copied ? "check_circle" : "content_copy"} className={iconSize} />
      {label && (
        <span className="text-xs">{copied ? "Copied" : label}</span>
      )}
    </button>
  );
}
