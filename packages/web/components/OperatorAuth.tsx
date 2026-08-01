"use client";

import { useSetOperator } from "@/lib/hooks/useSetOperator";

/**
 * Inline status + action banner for "approve PrivateOTC as operator".
 * Renders nothing if the connected wallet has already authorized OTC for
 * the given token. Shows a one-click authorization button otherwise.
 *
 * Mount this:
 *   - On the faucet page (so users authorize after first mint).
 *   - On accept-intent / submit-bid flows for the buyToken (taker side).
 *   - On create-intent flows for the sellToken (maker side).
 */
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
  /** Why this auth is needed — shown in the explanatory line */
  reason?: string;
  /** Hide the rationale paragraph for tight contexts */
  compact?: boolean;
}) {
  const { isOperator, isLoading, authorize, step, error } = useSetOperator(
    token,
    account,
  );

  if (!token || !account) return null;
  if (isLoading) return null;
  if (isOperator) return null; // Authorized — nothing to render

  const busy = step === "signing" || step === "confirming";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600">
          shield_lock
        </span>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-amber-800">
            Authorize Tradi-Nox for {symbol}
          </p>
          {!compact && (
            <p className="text-sm leading-relaxed text-amber-700">
              {reason ??
                `One-time authorization. Tradi-Nox needs operator permission on ${symbol} so settlement can pull encrypted tokens from your wallet during a trade.`}
            </p>
          )}
          <button
            onClick={authorize}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-60"
          >
            {step === "signing" && "Confirm in wallet…"}
            {step === "confirming" && "Authorizing…"}
            {(step === "idle" || step === "error") &&
              `Authorize Tradi-Nox (${symbol}, 60d)`}
            {step === "done" && "Authorized"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
