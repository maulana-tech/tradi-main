export type StrategyCategory = "otc" | "defi" | "arbitrage" | "liquidation" | "market-making";
export type StrategyStatus = "available" | "deployed" | "paused" | "error";

export interface Strategy {
  id: string;
  name: string;
  description: string;
  category: StrategyCategory;
  risk: "low" | "medium" | "high";
  chains: string[];
  features: string[];
  config: Record<string, { label: string; type: "string" | "number" | "boolean"; default: string; description: string }>;
  mcpTools: string[];
  icon: string;
}

export const STRATEGIES: Strategy[] = [
  {
    id: "rfq-market-maker",
    name: "RFQ Market Maker",
    description: "Automatically bid on sealed-bid RFQ auctions with configurable spread. Listens for new RFQs, encrypts bids via handle client, and submits through KeeperHub.",
    category: "market-making",
    risk: "medium",
    chains: ["Arbitrum Sepolia"],
    features: [
      "Auto-bid on new RFQs",
      "Configurable spread (basis points)",
      "Encrypted bid amounts",
      "KeeperHub execution",
      "Audit trail",
    ],
    config: {
      spreadBps: { label: "Spread (bps)", type: "number", default: "30", description: "Bid spread below fair price in basis points" },
      maxNotional: { label: "Max Notional", type: "string", default: "50000000000", description: "Maximum bid amount in raw token units" },
      pairs: { label: "Trading Pairs", type: "string", default: "cETH/cUSDC", description: "Comma-separated pair list" },
    },
    mcpTools: ["private_otc_read_rfq_state", "private_otc_get_price_reference", "private_otc_prepare_encrypted_bid"],
    icon: "trending_up",
  },
  {
    id: "rfq-sweeper",
    name: "RFQ Finalizer",
    description: "Monitors expired RFQ auctions and finalizes them after the bidding deadline. Computes encrypted second-price (Vickrey) and transitions to PendingReveal state.",
    category: "otc",
    risk: "low",
    chains: ["Arbitrum Sepolia"],
    features: [
      "Auto-finalize expired RFQs",
      "Vickrey second-price computation",
      "Gas-efficient batch processing",
      "Configurable scan interval",
    ],
    config: {
      scanInterval: { label: "Scan Interval (min)", type: "number", default: "5", description: "How often to scan for expired RFQs" },
      scanDepth: { label: "Scan Depth", type: "number", default: "50", description: "Number of recent intents to scan" },
    },
    mcpTools: ["private_otc_browse_intents", "private_otc_read_rfq_state"],
    icon: "cleaning_services",
  },
  {
    id: "settlement-monitor",
    name: "Settlement Monitor",
    description: "Watches for settlement events on-chain and sends notifications via webhook. Tracks completed trades and generates audit records.",
    category: "otc",
    risk: "low",
    chains: ["Arbitrum Sepolia"],
    features: [
      "Real-time settlement detection",
      "Webhook notifications",
      "Audit record generation",
      "Multi-chain support",
    ],
    config: {
      webhookUrl: { label: "Webhook URL", type: "string", default: "", description: "URL for settlement notifications" },
    },
    mcpTools: ["private_otc_browse_intents"],
    icon: "notifications",
  },
  {
    id: "strategy-coach",
    name: "Strategy Coach",
    description: "Daily analysis of trading activity. Scans settled events, computes win rates, P&L, and generates performance reports.",
    category: "otc",
    risk: "low",
    chains: ["Arbitrum Sepolia"],
    features: [
      "Daily performance reports",
      "Win rate tracking",
      "Counterparty analysis",
      "Webhook delivery",
    ],
    config: {
      reportInterval: { label: "Report Interval (hrs)", type: "number", default: "24", description: "Hours between reports" },
      webhookUrl: { label: "Webhook URL", type: "string", default: "", description: "URL for report delivery" },
    },
    mcpTools: ["private_otc_browse_intents"],
    icon: "insights",
  },
  {
    id: "direct-otc",
    name: "Direct OTC Trader",
    description: "Create and manage direct OTC trades. Set encrypted sell/buy amounts, find counterparties, and settle atomically.",
    category: "otc",
    risk: "medium",
    chains: ["Arbitrum Sepolia"],
    features: [
      "Encrypted trade amounts",
      "Atomic settlement",
      "Operator permission management",
      "NFT receipt minting",
    ],
    config: {
      defaultDeadline: { label: "Default Deadline (hrs)", type: "number", default: "168", description: "Default trade deadline in hours" },
    },
    mcpTools: ["private_otc_create_intent", "private_otc_browse_intents"],
    icon: "swap_horiz",
  },
];

export function getStrategy(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export function getStrategiesByCategory(category: StrategyCategory): Strategy[] {
  return STRATEGIES.filter((s) => s.category === category);
}
