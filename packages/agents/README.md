# Tradi — Autonomous Agents

Compound Engineering layer for the Tradi Confidential OTC desk. Each agent runs
independently and can be deployed as a long-running worker (Vercel Cron, a
self-hosted process, etc.).

## Agents

| Agent | Trigger | Job | Logic module |
|---|---|---|---|
| `market-maker` | `IntentCreated` (RFQ) | Computes spread-adjusted bid + auto-submits | [`market-maker/logic.ts`](src/market-maker/logic.ts) |
| `rfq-sweeper` | every 5 min (interval) | Finalizes expired RFQs with ≥2 bids | [`rfq-sweeper/logic.ts`](src/rfq-sweeper/logic.ts) |
| `settlement-monitor` | `Settled` events | Posts notification webhook (Slack/Discord shape) | [`settlement-monitor/logic.ts`](src/settlement-monitor/logic.ts) |
| `strategy-coach` | daily | Post-trade analysis | _scaffold_ |

Each agent's pure decision logic lives in `<agent>/logic.ts` so it's testable
without RPC/wallet/Nox plumbing. The runtime in `<agent>/index.ts` wires viem
clients and Nox SDK around that logic.

## Run

```bash
# Individual agents (development)
pnpm market-maker
pnpm rfq-sweeper
pnpm settlement-monitor
pnpm strategy-coach

# All agents under one process
pnpm dev

# Production
pnpm build && pnpm start

# Tests
pnpm test
pnpm test:coverage   # 100% coverage required on src/**/logic.ts
```

## Environment

All agents share `packages/agents/.env` (or workspace-root `.env`). Validation
runs at startup via zod — invalid env fails fast.

| Variable | Required by | Notes |
|---|---|---|
| `AGENT_PRIVATE_KEY` | all | 0x-prefixed 64-hex private key. **Separate from user wallet.** Falls back to `PRIVATE_KEY` for dev convenience. |
| `ARBITRUM_SEPOLIA_RPC_URL` | all | RPC endpoint. |
| `PRIVATE_OTC_ADDRESS` | all | Deployed `PrivateOTC` address. Falls back to `NEXT_PUBLIC_PRIVATE_OTC_ADDRESS`. |
| `NEXT_PUBLIC_CETH_ADDRESS` | market-maker | Quote-side cToken. |
| `NEXT_PUBLIC_CUSDC_ADDRESS` | market-maker | Base-side cToken. |
| `AGENT_NOTIFICATION_WEBHOOK` | settlement-monitor | Optional. Falls back to console log. |

## Conventions

- **ESM only** (`"type": "module"`, `.js` extensions on relative imports).
- Each agent exports `start{AgentName}()` — the runtime entry point.
- Pure logic lives in `<agent>/logic.ts` and **must hit 100% coverage**.
  CI gate enforces this; runtime files (`index.ts`) are out of scope.
- Logs prefixed `[agent-name]` for grep-ability across stdout streams.

## Don't

- Don't share `AGENT_PRIVATE_KEY` with user wallet keys.
- Don't decrypt user data without explicit auditor permission (`Nox.addViewer`).
- Don't poll RPC every second — use viem's `watchContractEvent` or a real
  scheduler (cron, queue) for batch work.
