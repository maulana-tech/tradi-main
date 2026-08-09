"use client";

import { useSetOperator } from "@/lib/hooks/useSetOperator";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";

export function OperatorAuth({
  token,
  account,
  symbol,
  reason,
  compact = false,
}: {
  token: `0x${string}` | undefined;
  account: `0x${string}` | undefined;
  symbol: string;
  reason?: string;
  compact?: boolean;
}) {
  const { isOperator, isLoading, authorize, step, error } = useSetOperator(token, account);
  if (!token || !account) {
    return <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-low)] p-4 text-sm text-[var(--color-text-secondary)]">Connect your wallet to check settlement permission.</p>;
  }
  if (isLoading) {
    return <div aria-label="Checking operator permission" className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-low)]" />;
  }
  if (isOperator) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] p-4">
        <Icon name="verified" className="mt-0.5 size-5 shrink-0 text-[var(--color-success-text)]" />
        <div><Badge tone="success">Ready</Badge><p className="mt-2 text-sm text-[var(--color-success-text)]">Tradi is authorized to settle {symbol} for this wallet.</p></div>
      </div>
    );
  }

  const busy = step === "signing" || step === "confirming";
  return (
    <div className="rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-4">
      <div className="flex items-start gap-3">
        <Icon name="shield_lock" className="mt-0.5 size-5 shrink-0 text-[var(--color-warning-text)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-white">Authorize settlement for {symbol}</p><Badge tone="warning">Action required</Badge></div>
          {!compact ? <p className="mt-2 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">{reason ?? `Tradi needs one-time operator permission on ${symbol} to complete atomic settlement.`}</p> : null}
          <Button type="button" tone="secondary" className="mt-4" onClick={() => void authorize()} loading={busy} loadingLabel={step === "signing" ? "Confirm in wallet…" : "Confirming permission…"}>
            Authorize {symbol} for 60 days
          </Button>
          {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger-text)]">{error} You can retry the authorization.</p> : null}
        </div>
      </div>
    </div>
  );
}
