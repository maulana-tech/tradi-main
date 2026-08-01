/**
 * Minimal ABI for PrivateOTC contract — only the fragments the frontend uses.
 *
 * Why hand-curated per-package (web/agents/mcp-server) instead of one shared?
 *   - Smaller bundle: ship only what each consumer calls
 *   - Tree-shakable: viem can verify call shapes at compile time
 *   - Stable: rebuilds of contracts don't churn unrelated packages
 *
 * Trade-off: keep these in sync manually when adding contract methods. Each
 * package's lint/typecheck will surface mismatches against actual usage.
 *
 * To regenerate after contract changes, look at:
 *   ../packages/contracts/out/PrivateOTC.sol/PrivateOTC.json
 */

export const privateOtcAbi = [
  {
    type: "function",
    name: "createIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sellToken", type: "address" },
      { name: "buyToken", type: "address" },
      { name: "sellAmountHandle", type: "bytes32" },
      { name: "sellProof", type: "bytes" },
      { name: "minBuyAmountHandle", type: "bytes32" },
      { name: "minBuyProof", type: "bytes" },
      { name: "deadline", type: "uint64" },
      { name: "allowedTaker", type: "address" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "acceptIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "buyAmountHandle", type: "bytes32" },
      { name: "buyProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelIntent",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "createRFQ",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sellToken", type: "address" },
      { name: "buyToken", type: "address" },
      { name: "sellAmountHandle", type: "bytes32" },
      { name: "sellProof", type: "bytes" },
      { name: "biddingDeadline", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "bidAmountHandle", type: "bytes32" },
      { name: "bidProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeRFQ",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "intents",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "maker", type: "address" },
      { name: "sellToken", type: "address" },
      { name: "buyToken", type: "address" },
      { name: "sellAmount", type: "bytes32" },
      { name: "minBuyAmount", type: "bytes32" },
      { name: "deadline", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "mode", type: "uint8" },
      { name: "allowedTaker", type: "address" },
      { name: "priceToPay", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "nextIntentId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "IntentCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "sellToken", type: "address", indexed: false },
      { name: "buyToken", type: "address", indexed: false },
      { name: "mode", type: "uint8", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BidSubmitted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "taker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "taker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "RFQPendingReveal",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "function",
    name: "revealRFQWinner",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "winnerIdx", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export type IntentStatus = 0 | 1 | 2 | 3 | 4; // Open | Filled | Cancelled | Expired | PendingReveal
export type Mode = 0 | 1; // Direct | RFQ
