# Agents Package — Compound Engineering Layer

## What is this?

Autonomous agents that "compound" the trader's edge by running continuously, preserving privacy via Nox, while the user focuses on higher-level strategy.

## Agents

| Agent | Trigger | Job |
|---|---|---|
| `market-maker` | viem watchContractEvent on `IntentCreated` | Auto-bid on RFQs matching the configured strategy |
| `rfq-sweeper` | setInterval 5 min | Finalize expired RFQs |
| `strategy-coach` | daily cron | Trade analysis |
| `settlement-monitor` | viem watchContractEvent on `Settled` | Post-trade audit + webhook |

## Seed scripts (`src/seed/`)

Demo data generators using deterministic test wallets derived from labels via `keccak256("tradi-nox-demo-${label}")` — wallets stay consistent across runs.

| Script | Purpose |
|---|---|
| `seed-multi.ts` | Bootstrap: fund 3 makers from admin, mint cTokens, authorize, create 1 intent each |
| `seed-bids.ts` / `seed-bids-7.ts` | Submit encrypted bids on existing RFQs |
| `seed-extra-bids.ts` | Top up bid count on a target RFQ |
| `seed-fresh-rfq.ts` / `seed-rfq-7.ts` | Spin up fresh RFQs |
| `seed-history.ts` | Bulk historical Settled trades for audit-trail demo |
| `seed-30d-demo.ts` | 30-day demo timeline (multi-intent, multi-status) |
| `seed-settled-examples.ts` | Mark a few intents as Settled |
| `seed-mixed-statuses.ts` | **Latest:** populate /intents with one of every state — Open / Filled / Cancelled / Soon-Expired (Direct) + Open / PendingReveal (RFQ) |
| `seed-authorize-operators.ts` | **One-shot fix:** every seed wallet calls `setOperator(PrivateOTC, +60d)` on both cTokens. Idempotent. Run after deploys to make seed-created intents settle-able |
| `check-balances.ts` | Read-only inventory check on every seed wallet |
| `diagnose-rfq.ts` | Inspect bid count + status of a target RFQ |

Run any script:

```bash
PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/<script>.ts
```

## Stack

- **Runtime:** Node 22 ESM
- **Lang:** TypeScript strict, tsx for dev
- **RPC:** viem v2
- **Encryption:** `@iexec-nox/handle`
- **State:** Vercel KV (encrypted strategy params)
- **Validation:** zod
- **Hosting:** Vercel Cron + Functions, or standalone

## Conventions

- ESM only (`"type": "module"`, `.js` extensions in imports)
- Each agent exports `start{Name}()` function
- All env vars validated via zod at startup — fail fast
- Logs prefixed `[agent-name]` for grep-ability
- No `console.log` on production paths — use pino / a structured logger

## Run

```bash
pnpm dev                       # all agents in watch mode
pnpm market-maker              # individual agent
pnpm build && pnpm start       # production
```

## Env

```
AGENT_PRIVATE_KEY              # bot wallet (separate from user)
ARBITRUM_SEPOLIA_RPC_URL
AGENT_NOTIFICATION_WEBHOOK     # Slack/Discord webhook
KV_REST_API_URL
KV_REST_API_TOKEN
```

## Don't

- DON'T share `AGENT_PRIVATE_KEY` with user wallet — separate key for separate concerns
- DON'T decrypt user data without explicit auditor permission (Nox.addViewer)
- DON'T poll RPC every second — use viem `watchContractEvent` (subscription)
