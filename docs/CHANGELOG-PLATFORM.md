# Changelog — Platform Migration

Dokumentasi semua perubahan yang dilakukan dalam sesi migrasi Tradi dari OTC desk ke platform.

## Ringkasan

Tradi berubah dari **confidential OTC desk** menjadi **AI-powered trading platform** dengan strategy marketplace, agent dashboard, dan KeeperHub execution integration.

---

## 1. MCP Server — Read/Prepare Tools

**Package:** `packages/mcp-server/`

### Tool Baru

| Tool | File | Fungsi |
|---|---|---|
| `private_otc_read_rfq_state` | `src/tools/readRfqState.ts` | Baca full RFQ state + bid count + canBid/canFinalize/canReveal flags |
| `private_otc_get_price_reference` | `src/tools/getPriceReference.ts` | Static testnet price reference untuk pair |
| `private_otc_prepare_encrypted_bid` | `src/tools/prepareEncryptedBid.ts` | Encrypt bid via handle client, return encoded calldata |
| `private_otc_explain_execution` | `src/tools/explainExecution.ts` | Interpret KeeperHub execution result + next steps |

### Yang Dihapus

| File | Alasan |
|---|---|
| `src/tools/keeperhubRelay.ts` | Stub yang tidak mengeksekusi apapun |
| `src/tools/__tests__/keeperhubRelay.test.ts` | Test untuk stub |

### ABI Update

`src/abi.ts` — ditambah:
- `submitBid` function
- `finalizeRFQ` function
- `revealRFQWinner` function
- `bids` mapping
- Events: `BidSubmitted`, `Settled`, `Cancelled`, `RFQPendingReveal`

### Test: 87 passing

---

## 2. Agents — Shared Executor + Writer Mode

**Package:** `packages/agents/`

### File Baru

| File | Fungsi |
|---|---|
| `src/executor.ts` | Shared executor: prepare → simulate → execute → poll → persist |
| `src/handle-client.ts` | Wrapper untuk `@iexec-nox/handle` (hide package name) |

### Yang Diubah

| File | Perubahan |
|---|---|
| `src/keeperhub-executor.ts` | Deprecated → re-export dari `executor.ts` |
| `src/config.ts` | Tambah `WRITER_MODE`, `KEEPERHUB_MCP_URL`, `KEEPERHUB_API_KEY` |
| `src/market-maker/index.ts` | Pakai `executor.ts`, respect `WRITER_MODE` |
| `src/rfq-sweeper/index.ts` | Pakai `executor.ts`, respect `WRITER_MODE` |
| 13 seed scripts | `tradi-nox-demo-` → `tradi-demo-`, import via `handle-client.ts` |

### WRITER_MODE

| Mode | Behavior |
|---|---|
| `agent` | Normal — agent execute langsung |
| `hermes` | Disabled — Hermes yang handle via KeeperHub |
| `dry-run` | Log only — tidak ada write |

### Test: 74 passing

---

## 3. Web — Platform Features

**Package:** `packages/web/`

### Halaman Baru

| Route | File | Fungsi |
|---|---|---|
| `/strategies` | `app/strategies/page.tsx` | Strategy Marketplace — browse, filter by category |
| `/strategies/[id]` | `app/strategies/[id]/page.tsx` | Strategy detail + deploy agent form |
| `/dashboard` | `app/dashboard/page.tsx` | Agent dashboard — monitor, start/stop/delete |
| `/notifications` | `app/notifications/page.tsx` | Notification center — full list + filters |

### API Routes Baru

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/strategies` | GET | List/filter strategies |
| `/api/agents` | GET/POST/PATCH | CRUD agents + start/stop/delete + auto-notif |
| `/api/keeperhub` | GET/POST | KeeperHub MCP proxy (simulate, execute, status, chains, test) |
| `/api/notifications` | GET/POST/PATCH | Notification CRUD + read/read-all |
| `/api/strategies/rating` | GET/POST | Strategy rating system |
| `/api/audit` | GET/POST | Audit record storage |

### Components Baru

| Component | File | Fungsi |
|---|---|---|
| `NotificationBell` | `components/NotificationBell.tsx` | Header bell icon + dropdown + unread count |
| `StarRating` | `components/StarRating.tsx` | Interactive 1-5 star rating |
| `TradiLogo` | `components/TradiLogo.tsx` | Renamed dari `TradiNoxLogo` |

### Hooks Baru

| Hook | File | Fungsi |
|---|---|---|
| `useDashboardStats` | `lib/hooks/useDashboardStats.ts` | Live on-chain stats (intents, balance) |
| `useKeeperHubAudit` | `lib/hooks/useKeeperHubAudit.ts` | Real audit data + sync fallback |
| `handle-client.ts` | `lib/handle-client.ts` | Encryption wrapper (renamed dari `nox-client.ts`) |

### Data Files

| File | Fungsi |
|---|---|
| `lib/strategies.ts` | 5 strategy definitions (RFQ Market Maker, RFQ Finalizer, Settlement Monitor, Strategy Coach, Direct OTC) |

---

## 4. KeeperHub Integration

### API Proxy (`/api/keeperhub`)

Flow MCP yang benar:
```
1. initialize → get mcp-session-id
2. notifications/initialized
3. tools/call dengan session ID
```

Session di-cache 55 menit, auto-refresh saat expired.

### Test Real Connection

```
KeeperHub MCP v1.2.0
43 tools available
nextIntentId = 43 (Arbitrum Sepolia)
```

### Tools yang Tersedia (43)

Workflows, execution, plugins, wallet, notifications, templates, marketplace, dll.

---

## 5. Brand Rename

| Sebelum | Sesudah |
|---|---|
| `Tradi-Nox` | `Tradi` |
| `TradiNoxLogo` | `TradiLogo` |
| `TradiNoxReceipt` (TS vars) | `TradiReceipt` |
| `tradiNoxReceiptAbi` | `tradiReceiptAbi` |
| `nox-client.ts` | `handle-client.ts` |
| `useNoxClient()` | `useHandleClient()` |
| `noxReady` | `handleReady` |
| `tradi-nox-demo-` | `tradi-demo-` |
| "iExec Nox" | "TEE" / "confidential computing" |
| "Nox TEE" | "TEE" |
| "Nox gateway" | "encryption gateway" |
| `@iexec-nox/handle` imports | wrapper via `handle-client.ts` |

---

## 6. Landing Page

### Content Baru

| Section | Content |
|---|---|
| Eyebrow | "AI-Powered Trading Platform · Arbitrum Sepolia" |
| Headline | "Automated strategies, private execution." |
| CTA | "Browse strategies" + "Open dashboard" |
| Platform | Strategy Marketplace + Agent Dashboard + Private OTC Desk |
| How it works | Choose strategy → Configure & deploy → Monitor & settle |
| Tech stack | Hermes AI, KeeperHub, Encrypted State, Atomic Settlement |
| CTA bottom | "Deploy your first strategy" → /strategies |
| Metadata | "AI-Powered Trading Platform" |

---

## 7. Navigation

### Sidebar

```
Platform
  ├── Dashboard
  ├── Strategies
  └── Notifications
Trading
  ├── Marketplace
  ├── Create Trade
  └── Portfolio
More
  ├── Activity
  ├── Analytics
  └── Faucet
```

### Header

- ConnectWallet hanya di: `/intents`, `/rfq`, `/create`, `/portfolio`, `/faucet`
- NotificationBell di semua halaman
- NetworkBadge di semua halaman

---

## 8. Hermes Config

### `hermes/config.yaml`

```yaml
mcp_servers:
  keeperhub:
    url: "https://app.keeperhub.com/mcp"
    headers:
      Authorization: "Bearer ${KEEPERHUB_API_KEY}"
    tools: [tools_documentation, list_action_schemas, get_wallet_integration, execute_contract_call, get_direct_execution_status]

  tradi_nox:
    command: "node"
    args: ["packages/mcp-server/dist/index.js"]
    env: [AGENT_PRIVATE_KEY, ARBITRUM_SEPOLIA_RPC_URL, NEXT_PUBLIC_PRIVATE_OTC_ADDRESS]
    tools: [private_otc_browse_intents, private_otc_read_rfq_state, private_otc_get_price_reference, private_otc_prepare_encrypted_bid, private_otc_explain_execution]
```

### `hermes/policy.md`

8 rules untuk Hermes decision-making:
1. Read before deciding
2. No plaintext from encrypted values
3. No direct writes
4. Always simulate first
5. Execute once with idempotency key
6. Terminal errors are final
7. Store evidence
8. Incomplete evidence = fail

---

## 9. Test Results

| Package | Tests | Status |
|---|---|---|
| `mcp-server` | 87 | ✅ All passing |
| `agents` | 74 | ✅ All passing |
| `web` | 179 | ✅ All passing |
| **Total** | **340** | **✅ All passing** |

---

## 10. Build Status

| Package | Build | Status |
|---|---|---|
| `agents` | `tsc` | ✅ |
| `mcp-server` | `tsc` | ✅ |
| `web` | `next build` | ✅ (22 routes) |
| `contracts` | `forge build` | ⚠️ Forge path issue (not needed — already deployed) |

---

## 11. Git History

```
0a544e0 refactor: clean up UI — platform-focused, remove clutter
bbdb7bc fix: KeeperHub API proxy with proper MCP session handshake
799c252 feat: quick wins — live data, notifications, ratings
850bb52 feat: add KeeperHub integration and notification center
0aea6f4 feat: update landing page to platform positioning
d63df84 feat: add strategy marketplace and agent dashboard
b006f07 feat: migrate to Hermes + KeeperHub architecture
```

---

## 12. File Count

| Category | Files Changed/Created |
|---|---|
| New files | ~30 |
| Modified files | ~60 |
| Deleted files | 3 |
| Total impact | ~90 files |
