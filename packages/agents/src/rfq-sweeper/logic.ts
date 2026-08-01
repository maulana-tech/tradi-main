/**
 * Pure decision logic for the RFQ sweeper agent.
 *
 * Runtime in ./index.ts handles RPC + tx submission; this module decides
 * whether a given on-chain intent is finalize-eligible.
 */

export type IntentTuple = readonly [
  `0x${string}`, // maker
  `0x${string}`, // sellToken
  `0x${string}`, // buyToken
  `0x${string}`, // sellAmountHandle
  `0x${string}`, // minBuyAmountHandle
  bigint, // deadline (unix seconds)
  number, // status: 0=Open 1=Filled 2=Cancelled 3=Expired
  number, // mode:   0=Direct 1=RFQ
  `0x${string}`, // allowedTaker
];

export type FinalizeDecision =
  | { kind: "finalize" }
  | { kind: "skip"; reason: string };

/**
 * Decide whether an RFQ should be finalized by the sweeper.
 *
 * Required: status=Open, mode=RFQ, deadline passed, >=2 active bids.
 * (The PrivateOTC.finalizeRFQ contract reverts InsufficientBids on <2.)
 */
export function decideFinalize(
  intent: IntentTuple,
  nowSeconds: bigint,
  bidCount: number,
): FinalizeDecision {
  const deadline = intent[5];
  const status = intent[6];
  const mode = intent[7];

  if (status !== 0) return { kind: "skip", reason: "not open" };
  if (mode !== 1) return { kind: "skip", reason: "not RFQ" };
  if (deadline >= nowSeconds) return { kind: "skip", reason: "bidding still active" };
  if (bidCount < 2) return { kind: "skip", reason: "insufficient bids" };

  return { kind: "finalize" };
}

/** Compute the inclusive scan window [start, end) for the latest N intents. */
export function scanWindow(
  nextIntentId: bigint,
  scanDepth: number,
): { start: bigint; end: bigint } {
  if (scanDepth <= 0) {
    throw new Error(`scanDepth must be positive: ${scanDepth}`);
  }
  const end = nextIntentId;
  const start = end > BigInt(scanDepth) ? end - BigInt(scanDepth) : 0n;
  return { start, end };
}
