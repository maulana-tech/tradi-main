"use client";

import { Icon } from "./Icon";
import type { KHState, KHStep } from "@/lib/hooks/useKeeperHubWrite";

const STEP_LABEL: Record<KHStep, string> = {
  idle: "Ready",
  encrypting: "Encrypting amounts...",
  simulating: "Simulating via KeeperHub...",
  executing: "Broadcasting transaction...",
  confirming: "Waiting for confirmation...",
  done: "Transaction confirmed",
  error: "Transaction failed",
};

const STEP_ICON: Record<KHStep, string> = {
  idle: "radio_button_unchecked",
  encrypting: "lock",
  simulating: "science",
  executing: "upload",
  confirming: "sync",
  done: "check_circle",
  error: "error",
};

export function KeeperHubStatus({ state }: { state: KHState }) {
  if (state.step === "idle") return null;

  const isError = state.step === "error";
  const isSuccess = state.step === "done";

  return (
    <div className={`rounded-xl border p-4 ${
      isSuccess
        ? "border-[var(--color-success)]/30 bg-[var(--color-success-soft)]"
        : isError
        ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]"
        : "border-[var(--color-border)] bg-[var(--color-surface-low)]"
    }`}>
      <div className="flex items-center gap-3">
        <Icon
          name={STEP_ICON[state.step]}
          className={`size-5 ${
            state.step === "confirming" || state.step === "executing" || state.step === "simulating"
              ? "animate-spin text-[var(--color-primary-text)]"
              : isSuccess
              ? "text-[var(--color-success-text)]"
              : isError
              ? "text-[var(--color-danger-text)]"
              : "text-[var(--color-text-muted)]"
          }`}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{STEP_LABEL[state.step]}</p>
          {state.executionId && (
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">
              ID: {state.executionId}
            </p>
          )}
        </div>
        {state.sponsored !== null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            state.sponsored
              ? "bg-[var(--color-success-soft)] text-[var(--color-success-text)]"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
          }`}>
            {state.sponsored ? "Sponsored" : "Paid"}
          </span>
        )}
      </div>

      {isSuccess && state.txHash && (
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-success)]/20 pt-3">
          <Icon name="link" className="size-3.5 text-[var(--color-success-text)]" />
          {state.txLink ? (
            <a
              href={state.txLink}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-[var(--color-success-text)] hover:underline"
            >
              {state.txHash.slice(0, 16)}...
            </a>
          ) : (
            <span className="font-mono text-xs text-[var(--color-success-text)]">
              {state.txHash.slice(0, 16)}...
            </span>
          )}
          {state.gasUsed && (
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              {Number(state.gasUsed).toLocaleString()} gas
            </span>
          )}
        </div>
      )}

      {isError && state.error && (
        <div className="mt-3 border-t border-[var(--color-danger)]/20 pt-3">
          <p className="text-xs text-[var(--color-danger-text)]">{state.error}</p>
          {state.txLink && (
            <a
              href={state.txLink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-primary-text)] hover:underline"
            >
              View on explorer <Icon name="open_in_new" className="size-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
