/**
 * Pure formatting logic for the settlement monitor agent.
 */
const ARBISCAN_TX_BASE = "https://sepolia.arbiscan.io/tx/";
/**
 * Build a webhook payload for a Settled event. Always returns a stable shape
 * so downstream Slack/Discord webhooks can be tested deterministically.
 */
export function formatSettlementNotification(args, txHash) {
    const idStr = args.id !== undefined ? args.id.toString() : "(unknown)";
    const takerStr = args.taker ?? "(unknown)";
    const txUrl = txHash ? `${ARBISCAN_TX_BASE}${txHash}` : "(no txHash)";
    return {
        text: `🔒 OTC settled — intent #${idStr} → taker ${takerStr}\n${txUrl}`,
    };
}
//# sourceMappingURL=logic.js.map