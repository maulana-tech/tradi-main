/**
 * Precision-safe arithmetic helpers for trade pricing.
 *
 * JS Number is IEEE 754 double — safe integer range is [-(2^53-1), 2^53-1].
 * Token amounts in raw units (e.g. 1 ETH = 1e18) overflow this range.
 *
 * These helpers stay precise by:
 *   - Using string parsing (decimal-friendly) instead of Number() casts
 *   - Returning bounded results when inputs are extreme
 *   - Treating division-by-zero / NaN as "no valid ratio" rather than crashing
 */

/**
 * Compute unit price from display-unit strings (e.g. "1.5", "3500.0").
 * Display units are user-facing decimals, so Number conversion is generally
 * safe — but we still validate to avoid NaN/Infinity propagation.
 *
 * @returns null when ratio is undefined (divide-by-zero, invalid input)
 */
export function safeUnitPrice(
  buyDisplayAmount: string,
  sellDisplayAmount: string,
): number | null {
  const buy = Number(buyDisplayAmount);
  const sell = Number(sellDisplayAmount);

  if (!Number.isFinite(buy) || !Number.isFinite(sell)) return null;
  if (sell <= 0) return null;
  // Reject buy <= 0: empty input parses to 0, and a 0 USD unit price
  // gives the AI advisor nothing to compare against.
  if (buy <= 0) return null;

  const ratio = buy / sell;
  if (!Number.isFinite(ratio)) return null;

  return ratio;
}

/**
 * Compute basis-point delta between two USD prices safely.
 * Returns null when fair price is invalid (zero, negative, NaN).
 *
 * @returns Integer bps (1 bps = 0.01%), clamped to ±100,000 bps (±1000%)
 */
export function safeDeltaBps(
  yourPriceUsd: number,
  fairPriceUsd: number,
): number | null {
  if (!Number.isFinite(yourPriceUsd) || !Number.isFinite(fairPriceUsd)) {
    return null;
  }
  if (fairPriceUsd <= 0) return null;

  const raw = ((yourPriceUsd - fairPriceUsd) / fairPriceUsd) * 10000;
  const clamped = Math.max(-100_000, Math.min(100_000, raw));
  return Math.round(clamped);
}
