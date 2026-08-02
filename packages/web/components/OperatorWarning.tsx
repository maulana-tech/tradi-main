"use client";

import { useIsOperator } from "@/lib/hooks/useSetOperator";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";

export function OperatorWarning({ token, holder, symbol, role }: { token: `0x${string}` | undefined; holder: `0x${string}` | undefined; symbol: string; role: string }) {
  const { isOperator, isLoading, refetch } = useIsOperator(token, holder);
  if (!token || !holder || isLoading || isOperator !== false) return null;
  return (
    <div role="alert" className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4">
      <div className="flex items-start gap-3">
        <Icon name="report" className="mt-0.5 size-5 shrink-0 text-[var(--color-danger-text)]" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Settlement is blocked by {role} permission</p>
          <p className="mt-2 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">The {role} has not authorized Tradi-Nox to transfer {symbol}. Ask them to authorize, then check again—or choose another counterparty.</p>
          <Button type="button" tone="secondary" size="sm" className="mt-4" onClick={() => void refetch()}><Icon name="refresh" className="size-4" />Check again</Button>
        </div>
      </div>
    </div>
  );
}
