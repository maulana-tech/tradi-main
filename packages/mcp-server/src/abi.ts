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
] as const;

export const erc7984Abi = [
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;
