/**
 * Pure decision logic for the market-maker agent.
 *
 * The runtime in ./index.ts wires viem subscriptions and Nox SDK calls; the
 * decision functions here are isolated for unit testing under London-school
 * strict — every dep is a parameter.
 */

export type Strategy = {
  pairs: Record<
    string,
    { sellToken: `0x${string}`; buyToken: `0x${string}`; refPriceUsd: number }
  >;
  maxNotional: bigint;
  /** Bid spread in basis points below fair price (30 = 0.3%). */
  spreadBps: number;
};

export type IntentEventArgs = {
  id?: bigint;
  maker?: `0x${string}`;
  sellToken?: `0x${string}`;
  buyToken?: `0x${string}`;
  /** 0 = Direct, 1 = RFQ. */
  mode?: number;
};

export type BidDecision =
  | { kind: "skip"; reason: string }
  | {
      kind: "bid";
      pairName: string;
      refPriceUsd: number;
      bidAmount: bigint;
      intentId: bigint;
    };

/**
 * Decide whether to bid on an IntentCreated event and what amount.
 * Returns a tagged union — `skip` reasons help logs/observability.
 */
export function decideBid(
  args: IntentEventArgs,
  ourAddress: string,
  strategy: Strategy,
): BidDecision {
  const { id, sellToken, buyToken, mode, maker } = args;

  if (id === undefined || !sellToken || !buyToken || mode === undefined) {
    return { kind: "skip", reason: "incomplete event args" };
  }
  // Only RFQs (mode == 1) are tradable by the market-maker.
  if (mode !== 1) {
    return { kind: "skip", reason: "not an RFQ" };
  }
  // Skip own RFQs to avoid wash-trading the bot's own intents.
  if (maker && maker.toLowerCase() === ourAddress.toLowerCase()) {
    return { kind: "skip", reason: "own RFQ" };
  }

  const matched = Object.entries(strategy.pairs).find(
    ([, cfg]) =>
      cfg.sellToken.toLowerCase() === sellToken.toLowerCase() &&
      cfg.buyToken.toLowerCase() === buyToken.toLowerCase(),
  );
  if (!matched) {
    return { kind: "skip", reason: "pair not in strategy" };
  }

  const [pairName, cfg] = matched;
  const bidAmount = computeBidAmount(strategy.maxNotional, strategy.spreadBps);

  return {
    kind: "bid",
    pairName,
    refPriceUsd: cfg.refPriceUsd,
    bidAmount,
    intentId: id,
  };
}

/**
 * Compute the actual bid amount in raw token units.
 *
 * Formula: maxNotional * (10000 - spreadBps) / 10000.
 * Integer division — rounds toward zero. spreadBps clamped to [0, 10000].
 */
export function computeBidAmount(
  maxNotional: bigint,
  spreadBps: number,
): bigint {
  if (spreadBps < 0 || spreadBps > 10000) {
    throw new Error(`spreadBps out of range [0,10000]: ${spreadBps}`);
  }
  return (maxNotional * BigInt(10000 - spreadBps)) / BigInt(10000);
}
