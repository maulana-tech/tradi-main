"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
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
    success: "border-l-[--color-primary] bg-[--color-surface]",
    error: "border-l-[--color-danger] bg-[--color-surface]",
    info: "border-l-[--color-border] bg-[--color-surface]",
  };
  const variantIcons: Record<ToastVariant, string> = {
    success: "check_circle",
    error: "error",
    info: "info",
  };
  const variantIconColor: Record<ToastVariant, string> = {
    success: "text-[--color-primary]",
    error: "text-[--color-danger]",
    info: "text-[--color-text-muted]",
  };

  const body = (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-[--color-border] border-l-2 p-3 shadow-md ${variantStyles[toast.variant]}`}
    >
      <span
        className={`material-symbols-outlined text-lg ${variantIconColor[toast.variant]}`}
      >
        {variantIcons[toast.variant]}
      </span>
      <p className="flex-1 text-sm leading-snug text-[--color-text]">
        {toast.message}
      </p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[--color-text-muted] transition hover:text-[--color-text]"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );

  if (toast.href) {
    return (
      <a
        href={toast.href}
        target="_blank"
        rel="noreferrer"
        className="block transition hover:brightness-105"
      >
        {body}
      </a>
    );
  }
  return body;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
