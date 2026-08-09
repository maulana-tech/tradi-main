# AGENTS.md

## Repo overview

pnpm monorepo (Node 22, pnpm 10). Four packages:

| Package | Path | Entry |
|---|---|---|
| contracts | `packages/contracts/` | Solidity 0.8.27 + Foundry |
| web | `packages/web/` | Next.js 16 App Router frontend |
| agents | `packages/agents/` | Autonomous viem bots + seed scripts |
| mcp-server | `packages/mcp-server/` | MCP server (stdio transport) |

## Commands

```bash
pnpm install                    # install all workspace deps
pnpm dev                        # frontend only (next dev --turbopack)

# Contracts
pnpm contracts:build            # forge build
pnpm contracts:test             # forge test -vvv
pnpm --filter contracts fmt     # forge fmt (format)
pnpm --filter contracts lint    # forge fmt --check

# Web
pnpm --filter web type-check    # tsc --noEmit
pnpm --filter web lint          # next lint
pnpm --filter web test          # vitest run

# Agents
pnpm agents:dev                 # all 4 agents in watch mode
pnpm --filter agents market-maker   # run single agent
pnpm --filter agents seed       # run seed data

# MCP
pnpm mcp:dev                    # tsx watch

# Seed scripts (require PRIVATE_KEY env)
PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/seed-authorize-operators.ts
```

## Pre-commit / CI

- **Pre-commit**: lint-staged runs type-check on changed `.ts`/`.tsx` in web, mcp-server, agents. No Solidity lint in pre-commit.
- **CI** (`.github/workflows/test.yml`): 4 parallel jobs — contracts (forge), web (vitest + tsc + build), agents (tsc + vitest), mcp-server (tsc + vitest).
- **Contracts CI** filters tests: `--match-contract 'PrivateOTCTest$|VickreyAlgorithmTest'`. Fork tests run separately when `ARBITRUM_SEPOLIA_RPC_URL` secret is set.
- **Gas snapshot**: CI runs `forge snapshot --check --tolerance 5`. If you change contract gas, update the snapshot with `forge snapshot`.
- **Web build** in CI uses zero-address placeholders for contract addresses.

## Foundry specifics

- Remappings in `foundry.toml` resolve `@iexec-nox/` and `@openzeppelin/` from `../../node_modules` (workspace root). Run `pnpm install` before `forge build`.
- Git submodules: `forge-std` and `openzeppelin-contracts` under `packages/contracts/lib/`. Clone with `--recurse-submodules` or run `git submodule update --init`.
- Invariant config is tuned down (32 runs, 20 depth) because fork-mode invariants hit the real Nox precompile.

## Nox encrypted state gotchas

These are the most likely mistakes an agent will make:

- `euint256` does NOT default to zero. Initialize explicitly: `Nox.toEuint256(0)`.
- After every encrypted op (`add`, `sub`, `select`, etc.), you MUST grant permissions: `Nox.allowThis(handle)` + `Nox.allow(handle, owner)`.
- You cannot branch on `ebool`. Use `Nox.select(cond, ifTrue, ifFalse)`.
- `Nox.add/sub/mul/div` are wrapping (no revert on overflow). Use `safeAdd/safeSub` which return `(ebool success, result)`.
- `Nox.div` by zero returns `MAX`, does not revert.
- Only `euint16` and `euint256` exist (no `euint64` etc.).
- RFQ Vickrey loops: cap at ~10 iterations for gas.
- Onchain SVG via `abi.encodePacked`: keep under ~12 args per call or you hit "Stack too deep". Split into helper functions returning `bytes`.

## Operator authorization invariant

Settlement (`acceptIntent`, `revealRFQWinner`) calls `confidentialTransferFrom` on BOTH sides. Both holders must have called `setOperator(PrivateOTC, until)` on the relevant cToken BEFORE settle, or `_settleAtomic` reverts with "TradiNoxCToken: not operator".

Seed wallets are authorized by: `pnpm --filter agents tsx src/seed/seed-authorize-operators.ts` (idempotent).

## Web frontend

- **Server Components by default.** `"use client"` only when wallet/hooks/state needed.
- **Tailwind v4**: CSS-based config in `globals.css` via `@theme {}`. Custom colors use `var(--color-*)` in className, not `bg-{color}` shorthand.
- **No `any`** — strict mode enforced.
- **Hooks before early returns**: `useReadContract`, `useSetOperator`, `useSettledTaker` etc. must sit above any `if (loading) return` branch. Past bug: react error #310 from moving hooks below loading checks.
- **Encrypted inputs**: always encrypt off-chain via `nox-client.encryptInput()` before contract writes.
- **Design**: terminal/matrix theme — `#0a0a0f` bg, `#00ff41` primary (matrix green), Inter + JetBrains Mono fonts.
- **Contract ABIs**: typed ABIs in `lib/abi/`, addresses in `lib/wagmi.ts`.
- Path alias: `@/*` maps to package root.

## Agents / ESM

- Agents package is `"type": "module"` — all imports must use `.js` extensions.
- Each agent exports `start{Name}()` function.
- Seed wallets are deterministic: `keccak256("tradi-nox-demo-${label}")`.
- Don't share `AGENT_PRIVATE_KEY` with user wallet.

## MCP server

- Tools use JSON Schema for `inputSchema` (not zod directly — MCP spec requires it).
- Return format: `{ content: [{ type: "text", text: ... }] }`.
- Inspect with: `pnpm --filter mcp-server inspect`.

## Environment

- `NEXT_PUBLIC_*` vars are client-exposed; others are server-only.
- Contracts need: `PRIVATE_KEY`, `ARBITRUM_SEPOLIA_RPC_URL`, `ARBISCAN_API_KEY`.
- Web needs: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, contract addresses, Nox gateway.
- Agents need: `AGENT_PRIVATE_KEY`, `ARBITRUM_SEPOLIA_RPC_URL`, KV credentials.
- Copy `.env.example` to `.env` and fill values.

## What NOT to build

Per project scope: no full ERC-3643, no full ERC-7540, no full lending protocol, no mainnet deploy. Contract name is `PrivateOTC` (immutable on-chain); "Tradi" is the brand/product name.

## Package-level docs

Each package has its own `CLAUDE.md` with detailed guidance. Read the relevant one before working in that package:
- `packages/contracts/CLAUDE.md` — Solidity patterns, Nox gotchas, deploy commands
- `packages/web/CLAUDE.md` — component structure, hook conventions, design system
- `packages/agents/CLAUDE.md` — agent list, seed scripts, ESM conventions
- `packages/mcp-server/CLAUDE.md` — MCP tool/resource definitions, inspector usage
