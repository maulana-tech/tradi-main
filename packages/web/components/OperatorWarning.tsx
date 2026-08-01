"use client";

import { useIsOperator } from "@/lib/hooks/useSetOperator";

/**
 * Diagnostic banner for *counterparty* operator status. Use when the
 * connected wallet cannot fix the missing authorization itself — e.g.
 * taker viewing a maker-created intent, or maker reviewing bidders
 * before picking a winner. For self-side authorization (where the user
 * CAN fix it), use <OperatorAuth> instead.
 *
 * Renders nothing while authorized or status unknown. Renders a red
 * blocker banner when status is definitively `false`.
 */
export function OperatorWarning({
  token,
  holder,
  symbol,
  role,
}: {
  token: `0x${string}` | undefined;
  holder: `0x${string}` | undefined;
  symbol: string;
  /** Who the holder is, surfaced in the warning copy ("maker", "winner bidder"). */
  role: string;
}) {
  const { isOperator, isLoading } = useIsOperator(token, holder);

  if (!token || !holder) return null;
  if (isLoading || isOperator !== false) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-red-600">
          report
        </span>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-red-800">
            {role} hasn&apos;t authorized {symbol}
          </p>
          <p className="text-sm leading-relaxed text-red-700">
            Settlement pulls {symbol} from the {role}&apos;s wallet, but they
            haven&apos;t set Tradi-Nox as operator. Trade will revert. Wait for
            the {role} to authorize, or pick a different counterparty.
          </p>
        </div>
      </div>
    </div>
  );
}
