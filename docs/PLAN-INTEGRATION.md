# Tradi Platform — Complete Integration Plan

## Vision

User bisa akses Tradi dari **3 channel**:
1. **Web Dashboard** — visual monitoring, manage agents, lihat execution logs
2. **Telegram Bot** — chat-based, deploy strategy, baca data, connect wallet
3. **API** — programmatic access untuk external integrations

Semua channel connect ke **Hermes (AI)** → **KeeperHub (Execution)** → **Blockchain**.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     USER LAYER                       │
├──────────┬──────────────┬───────────────────────────┤
│  Web UI  │  Telegram Bot│     API (REST/MCP)        │
├──────────┴──────────────┴───────────────────────────┤
│                    TRADI PLATFORM                    │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │  Strategy    │ │   Agent     │ │  Notification │ │
│  │  Marketplace │ │   Manager   │ │  Center       │ │
│  └──────┬──────┘ └──────┬──────┘ └───────┬───────┘ │
│         │               │                │         │
│  ┌──────┴───────────────┴────────────────┴───────┐ │
│  │              TRADI MCP SERVER                  │ │
│  │  (read state, prepare calldata, explain)       │ │
│  └────────────────────┬──────────────────────────┘ │
├───────────────────────┼─────────────────────────────┤
│                 HERMES (AI LAYER)                    │
│  ┌────────────────────┴──────────────────────────┐ │
│  │  Decision Engine                               │ │
│  │  - Read state from Tradi MCP                   │ │
│  │  - Get price reference                         │ │
│  │  - Decide: skip / submit / finalize            │ │
│  │  - Prepare encrypted calldata                  │ │
│  └────────────────────┬──────────────────────────┘ │
├───────────────────────┼─────────────────────────────┤
│              KEEPERHUB (EXECUTION)                   │
│  ┌────────────────────┴──────────────────────────┐ │
│  │  - Simulate transaction                        │ │
│  │  - Execute transaction                         │ │
│  │  - Poll status                                 │ │
│  │  - Gas sponsorship                             │ │
│  │  - Audit trail                                 │ │
│  └────────────────────┬──────────────────────────┘ │
├───────────────────────┼─────────────────────────────┤
│              BLOCKCHAIN (ARBITRUM SEPOLIA)           │
│  ┌────────────────────┴──────────────────────────┐ │
│  │  PrivateOTC │ cUSDC │ cETH │ TradiReceipt     │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Sudah Selesai ✅)

| Feature | Status |
|---|---|
| KeeperHub MCP connection | ✅ |
| Workflow creation + execution | ✅ |
| Execution logs + notifications | ✅ |
| Strategy marketplace (20 strategies) | ✅ |
| Agent dashboard | ✅ |
| Market page (real-time prices) | ✅ |
| Hermes config + policy | ✅ |

---

## Phase 2: Telegram Bot

### 2.1 Setup Telegram Bot

```
Files:
├── packages/telegram/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts              # Bot entry point
│   │   ├── bot.ts                # Bot logic + handlers
│   │   ├── handlers/
│   │   │   ├── start.ts          # /start command
│   │   │   ├── strategies.ts     # Browse + deploy strategies
│   │   │   ├── balance.ts        # Check wallet balance
│   │   │   ├── portfolio.ts      # View positions
│   │   │   ├── alerts.ts         # Manage alerts
│   │   │   └── settings.ts       # Wallet + preferences
│   │   ├── services/
│   │   │   ├── keeperhub.ts      # KeeperHub API client
│   │   │   ├── tradi.ts          # Tradi API client
│   │   │   └── wallet.ts         # Wallet management
│   │   └── utils/
│   │       ├── format.ts         # Message formatting
│   │       └── keyboard.ts       # Inline keyboards
│   └── .env.example
```

### 2.2 Bot Commands

| Command | Fungsi |
|---|---|
| `/start` | Welcome + main menu |
| `/strategies` | Browse available strategies |
| `/deploy <strategy>` | Deploy a strategy agent |
| `/balance [address]` | Check wallet balance |
| `/portfolio` | View active positions |
| `/alerts` | Manage price/health alerts |
| `/wallet` | Connect/manage wallet |
| `/status` | Check agent status |
| `/help` | Help + FAQ |

### 2.3 Conversation Flow

```
/start
├── Welcome to Tradi! 🚀
├── [Browse Strategies] [My Portfolio] [Connect Wallet]
└── Choose an action to get started.

/strategies
├── Available Strategies:
├── 📊 Monitoring
│   ├── 1. Wallet Balance Tracker
│   ├── 2. Aave Health Monitor
│   └── 3. Price Oracle Monitor
├── 💰 Yield
│   ├── 4. Compound Yield Farmer
│   └── 5. Lido Staking Manager
├── 🔄 DeFi
│   ├── 6. Uniswap Auto-Swap
│   └── 7. Aerodrome Swap
└── [Select number to deploy]

User: 1
├── Wallet Balance Tracker
├── Monitor native and ERC-20 token balances.
├── Features: Multi-wallet, Multi-token, Balance alerts
└── Enter wallet address to monitor:

User: 0x1234...
├── ✅ Creating Wallet Balance Tracker...
├── ✅ KeeperHub workflow created!
├── 📊 Current balances for 0x1234...:
│   ├── ETH: 1.234 ($4,321.00)
│   ├── USDC: 5,000.00
│   └── cETH: 0.5 (encrypted)
└── [View Dashboard] [Set Alert] [Deploy Another]
```

### 2.4 Wallet Connect via Telegram

```
/wallet
├── Connect your wallet to Tradi
├── Option 1: Import via private key (encrypted)
├── Option 2: Link existing Tradi wallet
└── Option 3: Generate new wallet

User: 1
├── ⚠️ Your key will be encrypted and stored securely.
├── Enter private key:
└── (User sends key → encrypted → stored)

User: (sends key)
├── ✅ Wallet connected!
├── Address: 0x1234...5678
├── Balance: 1.234 ETH
└── [Set as Default] [View Portfolio] [Disconnect]
```

---

## Phase 3: Hermes Integration

### 3.1 Hermes as Decision Engine

```
Files:
├── packages/agents/src/hermes/
│   ├── index.ts              # Hermes entry point
│   ├── decision.ts           # Decision logic
│   ├── strategies/
│   │   ├── balance-tracker.ts
│   │   ├── health-monitor.ts
│   │   ├── price-oracle.ts
│   │   └── yield-farmer.ts
│   └── mcp-client.ts         # MCP client for KeeperHub + Tradi
```

### 3.2 Hermes Decision Flow

```
User request (from Telegram or Web)
  → Hermes reads context (Tradi MCP)
  → Hermes gets price reference
  → Hermes decides action:
      - skip: nothing to do
      - monitor: set up watcher
      - execute: trigger KeeperHub workflow
  → Hermes prepares calldata (if needed)
  → Hermes calls KeeperHub MCP
  → Result flows back to user
```

### 3.3 Hermes MCP Config

```yaml
# hermes/config.yaml
mcp_servers:
  keeperhub:
    url: "https://app.keeperhub.com/mcp"
    headers:
      Authorization: "Bearer ${KEEPERHUB_API_KEY}"
    tools:
      - execute_contract_call
      - get_direct_execution_status
      - create_workflow
      - execute_workflow
      - list_action_schemas

  tradi:
    command: "node"
    args: ["packages/mcp-server/dist/index.js"]
    tools:
      - private_otc_browse_intents
      - private_otc_read_rfq_state
      - private_otc_get_price_reference
      - private_otc_prepare_encrypted_bid

  telegram:
    # Telegram bot sends user requests to Hermes
    # Hermes processes and responds back
```

---

## Phase 4: User Authentication

### 4.1 Wallet-Based Auth

```
User connects wallet → Signature verification → Session created

Web: RainbowKit / wagmi connect
Telegram: Private key or signature-based

Session stores:
- wallet address
- connected channel (web/telegram)
- preferences
- active agents
```

### 4.2 Auth Flow

```
1. User clicks "Connect Wallet" (web) or /wallet (Telegram)
2. Platform generates nonce
3. User signs nonce with wallet
4. Platform verifies signature
5. Session created with wallet address as identity
6. All subsequent requests linked to this wallet
```

---

## Phase 5: Persistent Storage

### 5.1 Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE,
  telegram_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agents
CREATE TABLE agents (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  strategy_id VARCHAR(50),
  name VARCHAR(100),
  status VARCHAR(20),
  writer_mode VARCHAR(20),
  keeperhub_workflow_id VARCHAR(50),
  config JSONB,
  deployed_at TIMESTAMP,
  last_run TIMESTAMP,
  runs INT DEFAULT 0,
  errors INT DEFAULT 0
);

-- Executions
CREATE TABLE executions (
  id VARCHAR(50) PRIMARY KEY,
  agent_id VARCHAR(50) REFERENCES agents(id),
  workflow_id VARCHAR(50),
  status VARCHAR(20),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INT,
  error TEXT,
  tx_hash VARCHAR(66),
  tx_link TEXT,
  gas_used VARCHAR(50),
  sponsored BOOLEAN,
  raw_data JSONB
);

-- Notifications
CREATE TABLE notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(20),
  source VARCHAR(20),
  title VARCHAR(200),
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
);

-- Wallet connections
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  address VARCHAR(42),
  chain_id INT,
  label VARCHAR(50),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
);
```

### 5.2 Storage Options

| Option | Pros | Cons |
|---|---|---|
| **Vercel Postgres** | Easy setup, serverless | Limited free tier |
| **Supabase** | Free tier, real-time | Extra dependency |
| **PlanetScale** | MySQL, serverless | MySQL syntax |
| **Redis (Upstash)** | Fast, simple | No relations |

**Recommendation:** Vercel Postgres (already in Vercel ecosystem)

---

## Phase 6: Onboarding Flow

### 6.1 First-Time User Experience

```
Step 1: Welcome
├── "Welcome to Tradi — AI-powered trading platform"
├── [Get Started] [Learn More]
└── Explains what Tradi does in 3 sentences

Step 2: Connect Wallet
├── "Connect your wallet to start trading"
├── [Connect Wallet] [Skip for now]
└── RainbowKit modal (web) or key input (Telegram)

Step 3: Choose Strategy
├── "What do you want to do?"
├── [Track Balances] [Monitor Health] [Earn Yield] [Trade OTC]
└── Quick strategy picker

Step 4: Configure
├── "Set up your first agent"
├── Input fields based on strategy
└── [Deploy] [Customize More]

Step 5: Success
├── "Your agent is running!"
├── [View Dashboard] [Deploy Another] [Explore Market]
└── Quick tour of key features
```

---

## Phase 7: Error Recovery

### 7.1 Error Types + Recovery

| Error | User Message | Recovery |
|---|---|---|
| KeeperHub timeout | "Execution is taking longer than expected" | Auto-retry + manual retry button |
| Simulation revert | "Transaction would fail on-chain" | Show reason + suggest fixes |
| Insufficient balance | "Not enough tokens" | Link to faucet |
| Operator not authorized | "Authorization needed" | One-click authorize button |
| Network error | "Connection issue" | Auto-retry with backoff |
| Workflow error | "Agent encountered an error" | Show error + restart button |

### 7.2 Error UI

```
┌─────────────────────────────────────┐
│ ❌ Execution Failed                  │
├─────────────────────────────────────┤
│ Error: Not enough cETH balance      │
│                                      │
│ Your balance: 0.5 cETH              │
│ Required: 1.0 cETH                  │
│                                      │
│ [Get Test Tokens] [Retry] [Details] │
└─────────────────────────────────────┘
```

---

## Implementation Timeline

### Week 1: Telegram Bot + Auth
| Day | Task |
|---|---|
| 1 | Setup Telegram bot, basic commands |
| 2 | Strategy browsing + deploy via Telegram |
| 3 | Wallet connect via Telegram |
| Balance check via Telegram |
| 4 | Portfolio view via Telegram |
| 5 | Alert management via Telegram |

### Week 2: Hermes Integration
| Day | Task |
|---|---|
| 1 | Hermes MCP client setup |
| 2 | Decision engine for balance/health strategies |
| 3 | Decision engine for yield/swap strategies |
| 4 | Telegram ↔ Hermes ↔ KeeperHub flow |
| 5 | End-to-end testing |

### Week 3: Persistent Storage + Auth
| Day | Task |
|---|---|
| 1 | Setup Vercel Postgres |
| 2 | User + wallet tables + API |
| 3 | Agent + execution persistence |
| 4 | Web wallet-based auth |
| 5 | Telegram wallet-based auth |

### Week 4: Polish + Production
| Day | Task |
|---|---|
| 1 | Onboarding flow (web + Telegram) |
| 2 | Error recovery UI |
| 3 | Contract verification on Arbiscan |
| 4 | Security review + testing |
| 5 | Production deploy |

---

## File Structure (Final)

```
tradi-nox/
├── packages/
│   ├── web/                    # Next.js dashboard
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── agents/
│   │   │   │   ├── audit/
│   │   │   │   ├── auth/
│   │   │   │   ├── keeperhub/
│   │   │   │   ├── market/
│   │   │   │   ├── notifications/
│   │   │   │   └── strategies/
│   │   │   ├── dashboard/
│   │   │   ├── executions/
│   │   │   ├── market/
│   │   │   ├── notifications/
│   │   │   ├── strategies/
│   │   │   └── ...
│   │   ├── components/
│   │   └── lib/
│   │
│   ├── agents/                 # Autonomous bots
│   │   ├── src/
│   │   │   ├── executor.ts
│   │   │   ├── hermes/         # NEW: Hermes decision engine
│   │   │   ├── market-maker/
│   │   │   ├── rfq-sweeper/
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── mcp-server/             # Tradi MCP tools
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── telegram/               # NEW: Telegram bot
│   │   ├── src/
│   │   │   ├── bot.ts
│   │   │   ├── handlers/
│   │   │   └── services/
│   │   └── ...
│   │
│   └── contracts/              # On-chain
│       └── ...
│
├── hermes/                     # Hermes config
│   ├── config.yaml
│   └── policy.md
│
└── docs/
    ├── CHANGELOG-PLATFORM.md
    ├── hermes.md
    └── migrasi.md
```

---

## Success Metrics

| Metric | Target |
|---|---|
| Telegram users | 100+ in first week |
| Workflows created | 50+ in first week |
| Successful executions | 90%+ success rate |
| Avg response time | < 5 seconds |
| User retention | 30%+ weekly active |

---

## Risks + Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| KeeperHub downtime | High | Fallback to direct Viem (dev only) |
| Gas costs | Medium | Use sponsorship when available |
| Private key security | High | Encrypt at rest, never log |
| Workflow errors | Medium | Comprehensive error handling |
| Rate limits | Medium | Exponential backoff, queue |
