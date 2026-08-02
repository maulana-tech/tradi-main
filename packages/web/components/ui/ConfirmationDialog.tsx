"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/Button";

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel,
  confirmTone = "danger",
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "primary" | "danger";
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={trigger} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--color-border-control)] bg-[var(--color-surface)] p-6 text-[var(--color-foreground)] shadow-xl focus:outline-none">
          <AlertDialog.Title className="font-display text-xl font-medium text-balance">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Close render={<Button tone="secondary" />}>Cancel</AlertDialog.Close>
            <AlertDialog.Close render={<Button tone={confirmTone} onClick={onConfirm} />}>
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
