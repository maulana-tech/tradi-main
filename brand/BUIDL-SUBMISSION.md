# Tradi-Nox — DoraHacks BUIDL Submission

> **Your trade. Their guess. Nobody knows.**
>
> Confidential on-chain OTC desk built on iExec Nox.

This file mirrors the [DoraHacks BUIDL page](https://dorahacks.io/hackathon/vibe-coding-iexec) submitted for the iExec Vibe Coding Challenge. Keep this in sync whenever DoraHacks content changes.

> ⚠️ **Demo video URL**: this file uses `https://youtu.be/_tMBT32r_kQ` (the canonical/active video). If the DoraHacks page still shows the older URL, edit it there to match.

---

## 🔗 Links

| | |
|---|---|
| 🌐 Live demo | https://private-otc.vercel.app |
| 🎥 Demo video | https://youtu.be/_tMBT32r_kQ |
| 🐦 Twitter post | https://x.com/BangDropID/status/2050295042296984047 |
| 💻 GitHub | https://github.com/maulana-tech/tradi-main |
| 📡 Network | Arbitrum Sepolia (chain id `421614`) |

## 🏷️ Tracks

**DeFi · TEE · Tokenization · Compliance · Institutional**

---

## 🎯 The Problem

**$30B+ flows through OTC desks every month** — and in 2026, all of it still happens via Telegram chats, manual fiat wires, and trusted-counterparty handshakes.

Whales who go on-chain instead hit two walls:

- **Public DEX** (Uniswap, Curve) — ~8% slippage on size, MEV sandwich attacks, leaked alpha as the order sits in the mempool.
- **OTC desk via Telegram** (GSR, Cumberland, Wintermute) — manual chat, fiat wires, no audit trail, full counterparty trust.

Existing "private DeFi" either leaks data via revert messages or breaks composability with ZK proofs. **There is no third option.**

## 💡 The Solution

Tradi-Nox is the third option: **on-chain OTC where amounts are encrypted end-to-end** via the iExec Nox confidential computing protocol and ERC-7984 confidential tokens.

- ✅ **Direct OTC mode** — 1 maker ↔ 1 taker, atomic encrypted swap
- ✅ **RFQ mode** — 1 maker ↔ N takers, sealed-bid Vickrey auction (best price wins, second price pays)
- ✅ **Atomic settlement** via `Nox.safeSub` + `Nox.select` — when a bid is too low, the trade settles as an encrypted no-op. On-chain status is always `Filled` — observers cannot distinguish a successful trade from a rejected bid. **Privacy preserved on rejection.**
- ✅ **Composable with any ERC-20** through Tradi-Nox's full ERC-7984 cToken implementation (cUSDC, cETH)
- ✅ **Auditable** via selective ACL disclosure — regulators can decrypt logs through key sharing

## 🏗️ Three-Layer Architecture

### 1. Core Protocol
`PrivateOTC.sol` + `TradiNoxCToken` on Arbitrum Sepolia. Solidity 0.8.27 + iExec Nox primitives.

### 2. Compound Engineering Layer
Four autonomous agents on Vercel Cron + Functions:

- **MarketMaker** — auto-bid on RFQs
- **RFQ Sweeper** — finalize expired auctions
- **Settlement Monitor** — webhook on every `Settled` event
- **Strategy Coach** — daily post-trade analysis

### 3. MCP Plugin Layer
Tradi-Nox exposes itself as AI-native tools. Any LLM (Claude, Cursor) can browse intents, create trades, and decrypt balances through a single MCP server. Ships with a Claude Code plugin (`/otc-*` slash commands).

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Smart Contracts | Solidity 0.8.27 · Foundry · `@iexec-nox/nox-protocol-contracts@0.2.2` |
| Confidential primitives | iExec Nox (TEE-based) · NoxCompute proxy on Arbitrum Sepolia |
| Encryption SDK | `@iexec-nox/handle@0.1.0-beta.10` (Viem v2) |
| Frontend | Next.js 16 (App Router · Turbopack) · wagmi v2 · RainbowKit · Tailwind v4 |
| AI | Procedural SVG receipt (client-side) |
| Autonomous agents | Node 22 · viem `watchContractEvent` · Vercel Cron + Functions |
| MCP server | `@modelcontextprotocol/sdk` (stdio transport) |
| Hosting | Vercel (production) |

## 📜 Deployed Contracts (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| PrivateOTC | [`0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4`](https://sepolia.arbiscan.io/address/0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4) |
| TradiNoxCToken cUSDC | [`0x57736B816F6cb53c6B2c742D3A162E89Db162ADE`](https://sepolia.arbiscan.io/address/0x57736B816F6cb53c6B2c742D3A162E89Db162ADE) |
| TradiNoxCToken cETH | [`0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d`](https://sepolia.arbiscan.io/address/0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d) |
| NoxCompute proxy (iExec) | [`0xd464B198f06756a1d00be223634b85E0a731c229`](https://sepolia.arbiscan.io/address/0xd464B198f06756a1d00be223634b85E0a731c229) |

## 🔐 Key Design Decision — Strategy B: Atomic Conditional Settlement

When a taker bid falls below the maker's hidden minimum, naive contracts either revert (leaking "bid too low" via the failed transaction) or trust the client to validate (defeating confidentiality).

Tradi-Nox uses `Nox.safeSub` + `Nox.select` to make the trade an atomic no-op when the bid is insufficient:

```solidity
(ebool sufficient, ) = Nox.safeSub(buyAmount, intent.minBuyAmount);

euint256 zero = Nox.toEuint256(0);
euint256 effectiveSell = Nox.select(sufficient, intent.sellAmount, zero);
euint256 effectiveBuy  = Nox.select(sufficient, buyAmount,        zero);

intent.sellToken.confidentialTransferFrom(maker, taker, euint256.unwrap(effectiveSell));
intent.buyToken.confidentialTransferFrom(taker, maker, euint256.unwrap(effectiveBuy));
intent.status = IntentStatus.Filled;
```

The branch (real vs zero) lives entirely inside encrypted handles. The on-chain status is always `Filled` — observers cannot distinguish a successful trade from a no-op rejection.

## 🚧 Challenges Faced

- **Beta SDK churn** — `@iexec-nox/handle@0.1.0-beta.10` had limited examples and shifting APIs during the hackathon. Wrote our own integration patterns and contributed `feedback.md` for the Nox team.
- **Privacy-preserving rejection** — a naive revert leaks the maker's hidden minimum. Solved with Strategy B (atomic conditional settlement) so the trade always finalizes, with real-or-zero amounts kept inside encrypted handles.
- **Full ERC-7984 spec compliance** — not partial (partial = DQ). Implemented all 8 transfer functions (4 plain + 4 transfer-and-call), `IERC7984Receiver` callback verification, and the operator pattern with `uint48` expiry.
- **End-to-end without mocks in <1 week** — real contracts, real Vercel infrastructure, real MCP server. No simulation anywhere.

## ✅ What's Real (no mocks)

- All three contracts deployed and verified on Arbitrum Sepolia
- `cUSDC.confidentialTotalSupply()` returns a real Nox handle
- `@iexec-nox/handle` and `@iexec-nox/nox-protocol-contracts` are the real iExec packages from npm
- Vickrey logic compiles against the real Nox library
- Frontend lives at https://private-otc.vercel.app — every route returns HTTP 200
- Every encrypted handle is a real reference to TEE-encrypted state

## 🗺️ Roadmap

- Mainnet deploy on Arbitrum
- ERC-3643 compliant institutional version (whitelist + KYC modules)
- Cross-chain RFQ via LayerZero
- Liquidation protection vault on top of Tradi-Nox settlements
- Open-source MCP plugin so any AI agent can route OTC flow

## 👤 Team

**Pugar Huda Mantoro** — solo builder
GitHub: https://github.com/maulana-tech

## 📄 License

MIT

---

## Supplementary copy bank (not on DoraHacks — for future grants / posts)

### Vision — paste-ready by character limit

| Char | Use |
|---|---|
| 125 | Twitter bio · clip teaser caption |
| 153 | Tagline-style |
| 222 | Default 256-char Vision field on most forms |

```
125: Confidential OTC on iExec Nox. Encrypted amounts, sealed Vickrey bids, fully on-chain. Your trade. Their guess. Nobody knows.

153: Tradi-Nox: confidential OTC on iExec Nox. Encrypted order amounts + sealed-bid Vickrey RFQ that hides losing bids. Institutional size privacy, fully on-chain.

222: Confidential OTC on iExec Nox. Trade amounts stay encrypted on-chain via TEE; a sealed-bid Vickrey RFQ settles without leaking losing bids. Institutional size privacy, fully on-chain. Your trade. Their guess. Nobody knows.
```

### Tagline bank

| Slot | Copy |
|---|---|
| Hero one-liner | "Your trade. Their guess. Nobody knows." |
| Elevator | "Tradi-Nox is a confidential OTC desk on Arbitrum where the trade amount is encrypted on-chain via iExec Nox. Makers post sealed intents, takers fill them blind, and an encrypted Vickrey auction picks the winner without leaking losing bids." |
| Twitter bio | "Confidential OTC on-chain. Sealed amounts, sealed bids, sealed wins. Built on @iEx_ec Nox." |
| Demo hook | "We took the part of OTC that institutions actually care about — size privacy — and put it on Arbitrum." |
| Sound bite | "OTC desks leak everything. We seal the trade amount on-chain. Your trade. Their guess. Nobody knows." |

### Brand palette

| Token | Hex | Use |
|---|---|---|
| Background | `#131313` | Page bg |
| Surface | `#1a1a1a` | Cards |
| Primary (matrix green) | `#00ff41` | Brand mark, CTA |
| Primary fg | `#002203` | Text on green buttons |
| Muted | `#84967e` | Secondary copy |
| Foreground | `#e5e2e1` | Body text |

Fonts: **Space Grotesk** (display + mono) · **Inter** (body)

Logo source: `brand/tradi-nox-icon-simple.svg`
