# 🚀 KeeperHub Zero-Cost Starter Tutorial

Learn how to run autonomous trading agents powered by **KeeperHub Execution Layer** and **Tradi Private OTC** in less than 2 minutes — with **100% Zero-Cost Testing (Tanpa Modal)**!

---

## 📋 Prerequisites
- Node.js >= 22
- pnpm >= 10

---

## ⚡ Quickstart (Under 2 Minutes)

### Step 1: Clone & Install
```bash
git clone https://github.com/maulana-tech/tradi-main.git
cd tradi-main
pnpm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure the zero-cost flags are set:
```env
KEEPERHUB_ENABLED=true
KEEPERHUB_GAS_SPONSORSHIP=true
KEEPERHUB_RELAYER_URL=https://relay.keeperhub.io/v1
```

### Step 3: Get Zero-Cost Test Tokens
Visit the built-in testnet faucet:
```
http://localhost:3000/faucet
```
Claim free testnet `cUSDC` and `cETH` tokens.

### Step 4: Run Autonomous Agents via KeeperHub
```bash
# Start all autonomous agents with KeeperHub Gas Sponsorship
pnpm agents:dev
```

You will see:
```text
[market-maker] starting
[rfq-sweeper] starting
[keeperhub-executor] Relaying submitBid via KeeperHub...
[keeperhub-executor] Relayed successfully via KeeperHub! sponsored=true
```

---

## 🛡️ Observability Dashboard
1. Launch web frontend: `pnpm dev`
2. Open `http://localhost:3000/history`
3. Click on the **KeeperHub Relayed** badge on any transaction row to inspect the **Audit Log Drawer** detailing simulation status, gas saved, and MEV protection.
