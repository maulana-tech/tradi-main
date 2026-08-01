/**
 * Shared ABI fragments for agents — duplicated from web package to keep
 * agents independently deployable (Vercel cron / standalone).
 */

export const privateOtcAbi = [
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
    name: "Settled",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "taker", type: "address", indexed: true },
    ],
  },
] as const;
