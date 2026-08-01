/**
 * Pure analysis logic for the strategy-coach agent.
 *
 * Without auditor-key decryption (which requires Nox.addViewer setup), we
 * can only see the *metadata* of settled trades — counts, pairs, peers.
 * That's still enough for a "you traded 12 times this week with 3 unique
 * counterparties" coach.
 */

export type SettledEvent = {
  id: bigint;
  taker: `0x${string}`;
  /** Unix seconds. */
  timestamp: number;
  txHash: `0x${string}`;
};

export type CoachReport = {
  windowDays: number;
  tradeCount: number;
  uniqueCounterparties: number;
  mostRecentTradeAt: number | null;
  /** Pre-formatted message ready to send to a webhook. */
  message: string;
};

const SECONDS_PER_DAY = 86_400;

/**
 * Build a coach report from a list of Settled events. Filters to the last
 * `windowDays` worth of events. Pure — no I/O, no decryption.
 */
export function buildCoachReport(
  events: SettledEvent[],
  nowSeconds: number,
  windowDays: number,
): CoachReport {
  if (windowDays <= 0) {
    throw new Error(`windowDays must be positive: ${windowDays}`);
  }

  const cutoff = nowSeconds - windowDays * SECONDS_PER_DAY;
  const recent = events.filter((e) => e.timestamp >= cutoff);

  const counterparties = new Set(recent.map((e) => e.taker.toLowerCase()));
  const mostRecent = recent.length > 0
    ? Math.max(...recent.map((e) => e.timestamp))
    : null;

  const message = formatMessage(recent.length, counterparties.size, windowDays);

  return {
    windowDays,
    tradeCount: recent.length,
    uniqueCounterparties: counterparties.size,
    mostRecentTradeAt: mostRecent,
    message,
  };
}

function formatMessage(
  tradeCount: number,
  counterparties: number,
  windowDays: number,
): string {
  if (tradeCount === 0) {
    return `📊 Strategy coach (${windowDays}d): no settled trades — consider deploying intents to keep your strategy alive.`;
  }

  const cpStr = counterparties === 1 ? "counterparty" : "counterparties";
  return (
    `📊 Strategy coach (${windowDays}d window):\n` +
    `• ${tradeCount} settled trade${tradeCount === 1 ? "" : "s"}\n` +
    `• ${counterparties} unique ${cpStr}\n` +
    `• Amounts encrypted on-chain — request auditor delegation for breakdown.`
  );
}
