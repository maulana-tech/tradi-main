/**
 * Pure decision logic for the RFQ sweeper agent.
 *
 * Runtime in ./index.ts handles RPC + tx submission; this module decides
 * whether a given on-chain intent is finalize-eligible.
 */
/**
 * Decide whether an RFQ should be finalized by the sweeper.
 *
 * Required: status=Open, mode=RFQ, deadline passed, >=2 active bids.
 * (The PrivateOTC.finalizeRFQ contract reverts InsufficientBids on <2.)
 */
export function decideFinalize(intent, nowSeconds, bidCount) {
    const deadline = intent[5];
    const status = intent[6];
    const mode = intent[7];
    if (status !== 0)
        return { kind: "skip", reason: "not open" };
    if (mode !== 1)
        return { kind: "skip", reason: "not RFQ" };
    if (deadline >= nowSeconds)
        return { kind: "skip", reason: "bidding still active" };
    if (bidCount < 2)
        return { kind: "skip", reason: "insufficient bids" };
    return { kind: "finalize" };
}
/** Compute the inclusive scan window [start, end) for the latest N intents. */
export function scanWindow(nextIntentId, scanDepth) {
    if (scanDepth <= 0) {
        throw new Error(`scanDepth must be positive: ${scanDepth}`);
    }
    const end = nextIntentId;
    const start = end > BigInt(scanDepth) ? end - BigInt(scanDepth) : 0n;
    return { start, end };
}
//# sourceMappingURL=logic.js.map