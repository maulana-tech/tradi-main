# Tradi

[![Tests](https://github.com/maulana-tech/tradi-main/actions/workflows/test.yml/badge.svg)](https://github.com/maulana-tech/tradi-main/actions/workflows/test.yml)

> **Your trade. Their guess. Nobody knows.**

Tradi — an AI-powered trading platform with strategy marketplace, autonomous agent execution, and confidential OTC settlement via KeeperHub.

## What Tradi Does

Tradi lets anyone deploy automated trading strategies with one click. The AI agent executes trades on-chain through KeeperHub — no private keys, no MetaMask, no friction.

- **Strategy Marketplace** — 20+ pre-built strategies (DeFi, OTC, Yield, Bridge, Notifications, Governance)
- **Agent Dashboard** — deploy, monitor, and manage autonomous trading agents
- **KeeperHub Execution** — all transactions signed and executed via KeeperHub's secure enclave
- **Wallet Integration** — connect via API key or get a managed wallet (no MetaMask needed)
- **Confidential OTC** — encrypted amounts with on-chain settlement via ERC-7984 tokens

---

## Demo

| | |
|---|---|
| 🚀 **Live demo** | https://tradi-main.vercel.app |
| 📦 **Source** | https://github.com/maulana-tech/tradi-main |
| 📡 **Network** | Arbitrum Sepolia (chain id `421614`) |
| 🔑 **Stack** | Next.js 16 · Solidity 0.8.27 · KeeperHub · MCP |

---

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+

### Install

```bash
git clone https://github.com/maulana-tech/tradi-main.git
cd tradi-main
pnpm install
cp .env.example .env
# Fill .env with your values
```

### Run the frontend

```bash
pnpm dev
# Open http://localhost:3000
```

### Connect Your Wallet

1. Go to `/wallet`
2. **Option A: API Key** — Enter your KeeperHub API key to connect your existing wallet
3. **Option B: Managed Wallet** — Click "Create Managed Wallet" to get a wallet powered by KeeperHub

No MetaMask or WalletConnect required. KeeperHub manages keys via Turnkey secure enclave.

---

## How It Works

### User Flow

```
1. User visits Tradi → connects KeeperHub wallet
2. Browses Strategy Marketplace → picks a strategy
3. Clicks "Deploy" → KeeperHub workflow created
4. Agent executes trades automatically on-chain
5. User monitors performance on Dashboard
```

### Agent Execution via KeeperHub

```
User clicks "Start Agent"
  → API creates KeeperHub workflow
  → KeeperHub simulates transaction
  → KeeperHub signs via Turnkey secure enclave
  → Transaction broadcast to Arbitrum Sepolia
  → Status updated in real-time
```

---

## Strategy Marketplace

20 strategies across 7 categories:

| Category | Strategies |
|---|---|
| **OTC Trading** | Market Maker, RFQ Sweeper, Settlement Monitor, Strategy Coach |
| **Yield Optimization** | Aave V3 Lender, Compound V3, Yearn Vault, Lido Staker |
| **DeFi Automation** | Uniswap Swap, Curve Pool, Balancer Weighted |
| **Price Monitoring** | Chainlink Oracle, Price Alert, TWAP Oracle |
| **Cross-Chain** | Superfluid Stream, CoW Protocol |
| **Notifications** | Balance Alert, Settlement Notify |
| **Governance** | Snapshot Voting, Compound Governor |

Each strategy maps to a real KeeperHub plugin action (Aave, Compound, Yearn, Lido, Uniswap, Chainlink, Superfluid, CoW Protocol).

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Tradi Web UI                    │
│  Strategy Marketplace · Agent Dashboard · Wallet │
├─────────────────────────────────────────────────┤
│              KeeperHub API Proxy                 │
│  Workflow Create · Execute · Poll · Status       │
├─────────────────────────────────────────────────┤
│               KeeperHub MCP Server               │
│  web3 · aave · compound · yearn · chainlink     │
├─────────────────────────────────────────────────┤
│            Turnkey Secure Enclave                 │
│  Key Management · Transaction Signing            │
├─────────────────────────────────────────────────┤
│               Arbitrum Sepolia                   │
│  PrivateOTC · cUSDC · cETH · TradiReceipt       │
└─────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| `PrivateOTC` | [`0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4`](https://sepolia.arbiscan.io/address/0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4) |
| `cUSDC` | [`0x57736B816F6cb53c6B2c742D3A162E89Db162ADE`](https://sepolia.arbiscan.io/address/0x57736B816F6cb53c6B2c742D3A162E89Db162ADE) |
| `cETH` | [`0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d`](https://sepolia.arbiscan.io/address/0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d) |
| `TradiReceipt` | [`0xE011E57ff89a9b1450551A7cE402b75c5Bd27B85`](https://sepolia.arbiscan.io/address/0xE011E57ff89a9b1450551A7cE402b75c5Bd27B85) |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 · wagmi v2 · RainbowKit · Tailwind v4 |
| Smart Contracts | Solidity 0.8.27 · Foundry · OpenZeppelin |
| Agent Execution | KeeperHub MCP · Turnkey Secure Enclave |
| Wallet | KeeperHub Wallet (API Key or Managed) |
| AI | Hermes Decision Engine · MCP Server |
| Hosting | Vercel |

---

## Project Structure

```
tradi-main/
├── packages/
│   ├── contracts/        # Solidity + Foundry
│   ├── web/              # Next.js frontend
│   ├── agents/           # Autonomous trading agents
│   └── mcp-server/       # MCP tools for AI agents
├── docs/
│   ├── migrasi.md        # Migration plan
│   └── hermes.md         # Hermes setup runbook
├── hermes/               # Hermes AI config
│   ├── config.yaml
│   └── policy.md
├── AGENTS.md             # Repository instructions
└── README.md
```

---

## License

MIT
