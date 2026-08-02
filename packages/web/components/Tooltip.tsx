"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";
import { Icon } from "./Icon";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: ReactElement;
  side?: "top" | "bottom";
}) {
  return (
    <BaseTooltip.Provider delay={300}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
            <BaseTooltip.Popup
              role="tooltip"
              className="max-w-xs rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm leading-5 text-pretty text-white shadow-lg transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}

export function HelpHint({ content }: { content: string }) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        aria-label={content}
        className="inline-grid size-11 place-items-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-white"
      >
        <Icon name="help" className="size-4" />
      </button>
    </Tooltip>
  );
}
