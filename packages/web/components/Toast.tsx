"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  href?: string;
};

type ToastApi = {
  show: (
    message: string,
    options?: { variant?: ToastVariant; durationMs?: number; href?: string },
  ) => void;
  success: (message: string, options?: { href?: string }) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const show: ToastApi["show"] = (message, options) => {
      const toast: Toast = {
        id: nextId++,
        message,
        variant: options?.variant ?? "info",
        durationMs: options?.durationMs ?? 4000,
        href: options?.href,
      };
      setToasts((curr) => [...curr, toast]);
    };
    return {
      show,
      success: (message, options) =>
        show(message, { variant: "success", href: options?.href }),
      error: (message) => show(message, { variant: "error", durationMs: 6000 }),
      info: (message) => show(message, { variant: "info" }),
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts
      .filter((t) => t.durationMs > 0)
      .map((t) => setTimeout(() => dismiss(t.id), t.durationMs));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:bottom-4"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const variantStyles: Record<ToastVariant, string> = {
    success: "border-l-[var(--color-success)] bg-[var(--color-surface)]",
    error: "border-l-[var(--color-danger)] bg-[var(--color-surface)]",
    info: "border-l-[var(--color-border)] bg-[var(--color-surface)]",
  };
  const variantIcons: Record<ToastVariant, string> = {
    success: "check_circle",
    error: "error",
    info: "info",
  };
  const variantIconColor: Record<ToastVariant, string> = {
    success: "text-[var(--color-success-text)]",
    error: "text-[var(--color-danger)]",
    info: "text-[var(--color-text-muted)]",
  };

  const body = (
    <div
      className={cn("pointer-events-auto flex items-start gap-3 rounded-2xl border border-[var(--color-border)] border-l-2 p-4 shadow-lg", variantStyles[toast.variant])}
    >
      <Icon name={variantIcons[toast.variant]} className={cn("mt-0.5 size-[18px]", variantIconColor[toast.variant])} />
      <p className="flex-1 text-sm leading-snug text-[var(--color-text)]">
        {toast.message}
      </p>
      {toast.href ? (
        <a
          href={toast.href}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 shrink-0 content-center text-sm font-semibold text-[var(--color-primary-text)] hover:text-white"
        >
          View
        </a>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-surface-raised)] hover:text-white"
      >
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );

  return body;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
