export type StrategyCategory = "otc" | "defi" | "yield" | "monitoring" | "bridge" | "notifications" | "governance";
export type StrategyStatus = "available" | "deployed" | "paused" | "error";

export interface Strategy {
  id: string;
  name: string;
  description: string;
  category: StrategyCategory;
  risk: "low" | "medium" | "high";
  chains: string[];
  features: string[];
  keeperhubActions: string[];
  icon: string;
  isNew?: boolean;
}

export const STRATEGIES: Strategy[] = [
  // ─── OTC ───
  {
    id: "rfq-market-maker",
    name: "RFQ Market Maker",
    description: "Auto-bid on sealed-bid RFQ auctions with configurable spread. Encrypts bids via handle client and submits through KeeperHub.",
    category: "otc",
    risk: "medium",
    chains: ["Arbitrum Sepolia"],
    features: ["Auto-bid on RFQs", "Configurable spread", "Encrypted bids", "Audit trail"],
    keeperhubActions: ["web3/read-contract"],
    icon: "trending_up",
  },
  {
    id: "rfq-sweeper",
    name: "RFQ Finalizer",
    description: "Monitors expired RFQ auctions and finalizes them. Computes Vickrey second-price and transitions to PendingReveal.",
    category: "otc",
    risk: "low",
    chains: ["Arbitrum Sepolia"],
    features: ["Auto-finalize", "Vickrey pricing", "Gas-efficient"],
    keeperhubActions: ["web3/read-contract"],
    icon: "cleaning_services",
  },

  // ─── YIELD ───
  {
    id: "aave-supply-monitor",
    name: "Aave Health Monitor",
    description: "Monitor your Aave V3 health factor hourly. Alert via Discord/email when it drops below safety threshold.",
    category: "monitoring",
    risk: "low",
    chains: ["Ethereum", "Base", "Arbitrum"],
    features: ["Health factor tracking", "Collateral ratio alerts", "Multi-chain", "Discord/Telegram alerts"],
    keeperhubActions: ["aave-v3/get-user-account-data", "discord/send-message", "telegram/send-message"],
    icon: "health_and_safety",
    isNew: true,
  },
  {
    id: "aave-auto-topup",
    name: "Aave Auto Top-Up",
    description: "When health factor drops below threshold, automatically supply collateral to prevent liquidation.",
    category: "defi",
    risk: "medium",
    chains: ["Ethereum", "Base", "Arbitrum"],
    features: ["Auto collateral supply", "Liquidation prevention", "Configurable threshold", "Gas optimization"],
    keeperhubActions: ["aave-v3/get-user-account-data", "aave-v3/supply", "Condition"],
    icon: "shield",
    isNew: true,
  },
  {
    id: "compound-yield",
    name: "Compound Yield Farmer",
    description: "Supply assets to Compound V3 to earn interest. Monitor supply rates and auto-compound rewards.",
    category: "yield",
    risk: "low",
    chains: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    features: ["Auto supply", "Rate monitoring", "Compound interest", "Multi-market"],
    keeperhubActions: ["compound/supply", "compound/get-supply-rate", "compound/get-balance"],
    icon: "savings",
    isNew: true,
  },
  {
    id: "yearn-vault-depositor",
    name: "Yearn Vault Depositor",
    description: "Deposit assets into Yearn V3 vaults for automated yield optimization.",
    category: "yield",
    risk: "medium",
    chains: ["Ethereum"],
    features: ["ERC-4626 vaults", "Auto-optimization", "Share tracking"],
    keeperhubActions: ["yearn/vault-deposit", "yearn/vault-balance", "yearn/vault-total-assets"],
    icon: "account_balance",
    isNew: true,
  },
  {
    id: "lido-staking",
    name: "Lido Staking Manager",
    description: "Manage stETH/wstETH positions. Wrap, unwrap, and track exchange rates.",
    category: "yield",
    risk: "low",
    chains: ["Ethereum"],
    features: ["stETH wrapping", "Rate monitoring", "Balance tracking"],
    keeperhubActions: ["lido/wrap", "lido/unwrap", "lido/steth-per-token", "lido/get-wsteth-balance"],
    icon: "currency_exchange",
    isNew: true,
  },

  // ─── MONITORING ───
  {
    id: "price-oracle-monitor",
    name: "Price Oracle Monitor",
    description: "Track ETH/USD, BTC/USD, USDC/USD prices from Chronicle oracle. Alert on significant price movements.",
    category: "monitoring",
    risk: "low",
    chains: ["Ethereum"],
    features: ["Multi-asset prices", "Price alerts", "Historical tracking", "Custom thresholds"],
    keeperhubActions: ["chronicle/eth-usd-read", "chronicle/btc-usd-read", "chronicle/usdc-usd-read", "Condition"],
    icon: "candlestick_chart",
    isNew: true,
  },
  {
    id: "wallet-balance-tracker",
    name: "Wallet Balance Tracker",
    description: "Monitor native and ERC-20 token balances across multiple wallets. Alert on significant changes.",
    category: "monitoring",
    risk: "low",
    chains: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    features: ["Multi-wallet", "Multi-token", "Balance alerts", "Transfer detection"],
    keeperhubActions: ["web3/check-balance", "web3/check-token-balance", "Condition"],
    icon: "account_balance_wallet",
    isNew: true,
  },
  {
    id: "settlement-monitor",
    name: "Settlement Monitor",
    description: "Watch for settlement events on PrivateOTC and send notifications via webhook.",
    category: "monitoring",
    risk: "low",
    chains: ["Arbitrum Sepolia"],
    features: ["Real-time detection", "Webhook notifications", "Audit records"],
    keeperhubActions: ["web3/read-contract", "webhook/send-webhook"],
    icon: "notifications",
  },
  {
    id: "contract-event-watcher",
    name: "Contract Event Watcher",
    description: "Monitor any smart contract for specific events. Custom filters and multi-channel alerts.",
    category: "monitoring",
    risk: "low",
    chains: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    features: ["Custom events", "Multi-channel alerts", "Filter conditions"],
    keeperhubActions: ["web3/read-contract", "Condition", "discord/send-message", "telegram/send-message", "slack/send-message"],
    icon: "visibility",
    isNew: true,
  },

  // ─── BRIDGE ───
  {
    id: "ccip-cross-chain",
    name: "Cross-Chain Bridge (CCIP)",
    description: "Bridge tokens cross-chain using Chainlink CCIP. Supports multiple networks with fee estimation.",
    category: "bridge",
    risk: "medium",
    chains: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    features: ["Cross-chain transfers", "Fee estimation", "Token approval", "Status tracking"],
    keeperhubActions: ["chainlink/ccip-get-fee", "chainlink/ccip-send", "chainlink/ccip-approve-bridge-token", "chainlink/ccip-check-bridge-balance"],
    icon: "swap_horiz",
    isNew: true,
  },

  // ─── DEX ───
  {
    id: "uniswap-swapper",
    name: "Uniswap Auto-Swap",
    description: "Execute token swaps on Uniswap V3 with optimal routing. Supports multiple fee tiers.",
    category: "defi",
    risk: "medium",
    chains: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    features: ["Exact input swaps", "Multi-fee tier", "Slippage protection"],
    keeperhubActions: ["uniswap/swap-exact-input", "uniswap/get-pool"],
    icon: "swap_calls",
    isNew: true,
  },
  {
    id: "aerodrome-swapper",
    name: "Aerodrome Swap (Base)",
    description: "Swap tokens on Aerodrome DEX on Base. Supports stable and volatile pools.",
    category: "defi",
    risk: "medium",
    chains: ["Base"],
    features: ["Stable/volatile pools", "LP management", "Gauge rewards"],
    keeperhubActions: ["aerodrome/swap-exact-tokens", "aerodrome/add-liquidity", "aerodrome/get-reserves"],
    icon: "token",
    isNew: true,
  },

  // ─── NOTIFICATIONS ───
  {
    id: "multi-channel-notifier",
    name: "Multi-Channel Notifier",
    description: "Send alerts to Discord, Telegram, Slack, and email simultaneously. Template-based messages.",
    category: "notifications",
    risk: "low",
    chains: [],
    features: ["Discord", "Telegram", "Slack", "Email", "Templates"],
    keeperhubActions: ["discord/send-message", "telegram/send-message", "slack/send-message", "sendgrid/send-email"],
    icon: "campaign",
    isNew: true,
  },
  {
    id: "webhook-relay",
    name: "Webhook Relay",
    description: "Receive webhooks and forward to multiple endpoints. Transform data between formats.",
    category: "notifications",
    risk: "low",
    chains: [],
    features: ["HTTP relay", "Data transform", "Multi-destination"],
    keeperhubActions: ["webhook/send-webhook", "HTTP Request"],
    icon: "sync_alt",
    isNew: true,
  },

  // ─── GOVERNANCE ───
  {
    id: "safe-multisig-monitor",
    name: "Safe Multisig Monitor",
    description: "Monitor Safe multisig pending transactions, owner changes, and threshold updates.",
    category: "governance",
    risk: "low",
    chains: ["Ethereum", "Base", "Arbitrum", "Polygon"],
    features: ["Pending tx tracking", "Owner monitoring", "Threshold alerts"],
    keeperhubActions: ["safe/get-owners", "safe/get-threshold", "safe/get-pending-transactions"],
    icon: "admin_panel_settings",
    isNew: true,
  },
  {
    id: "strategy-coach",
    name: "Strategy Coach",
    description: "Daily analysis of trading activity. Scan settled events, compute win rates and P&L.",
    category: "otc",
    risk: "low",
    chains: ["Arbitrum Sepolia"],
    features: ["Daily reports", "Win rate", "Counterparty analysis"],
    keeperhubActions: ["web3/read-contract"],
    icon: "insights",
  },

  // ─── SUPERFLUID ───
  {
    id: "superfluid-stream",
    name: "Superfluid Money Stream",
    description: "Create continuous payment streams. Pay salaries, subscriptions, or recurring transfers in real-time.",
    category: "defi",
    risk: "medium",
    chains: ["Polygon", "Base", "Arbitrum", "Optimism"],
    features: ["Continuous streaming", "Real-time payments", "Stream management"],
    keeperhubActions: ["superfluid/create-flow", "superfluid/update-flow", "superfluid/delete-flow", "superfluid/get-flow"],
    icon: "waterfall_chart",
    isNew: true,
  },
];

export function getStrategy(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export function getStrategiesByCategory(category: StrategyCategory): Strategy[] {
  return STRATEGIES.filter((s) => s.category === category);
}

export const CATEGORIES: { value: StrategyCategory | "all"; label: string; count: number }[] = [
  { value: "all", label: "All", count: STRATEGIES.length },
  { value: "monitoring", label: "Monitoring", count: STRATEGIES.filter((s) => s.category === "monitoring").length },
  { value: "yield", label: "Yield", count: STRATEGIES.filter((s) => s.category === "yield").length },
  { value: "defi", label: "DeFi", count: STRATEGIES.filter((s) => s.category === "defi").length },
  { value: "otc", label: "OTC", count: STRATEGIES.filter((s) => s.category === "otc").length },
  { value: "bridge", label: "Bridge", count: STRATEGIES.filter((s) => s.category === "bridge").length },
  { value: "notifications", label: "Notifications", count: STRATEGIES.filter((s) => s.category === "notifications").length },
  { value: "governance", label: "Governance", count: STRATEGIES.filter((s) => s.category === "governance").length },
];
