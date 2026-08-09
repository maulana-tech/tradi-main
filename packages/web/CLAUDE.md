# Web Package — PrivateOTC Frontend

## Stack

- **Framework:** Next.js 16 (App Router) + Turbopack
- **Wallet:** wagmi v2 + RainbowKit
- **Encryption:** `@iexec-nox/handle` (Viem v2 client — wrapped via `lib/handle-client.ts`)
- **UI:** Tailwind CSS v4 (CSS-based config in `globals.css`)
- **AI:** Procedural SVG receipt generation
- **Deploy:** Vercel

## Structure

```
app/
├── page.tsx                # Landing
├── layout.tsx              # Root layout, fonts, providers
├── providers.tsx           # WagmiProvider + RainbowKitProvider + ReactQuery
├── globals.css             # Tailwind + theme tokens (CSS variables)
├── intents/                # Paginated orderbook + detail (Direct accept page)
├── create/                 # Create OTC intent or RFQ (with operator gating)
├── rfq/                    # RFQ detail (bid + reveal panel)
├── portfolio/              # User's intents/bids + decrypt
├── faucet/                 # Mint cTokens + per-token operator authorize

components/
├── AppShell.tsx, Header.tsx, PageHeader.tsx
├── OperatorAuth.tsx        # Self-side authorize banner (one-click setOperator)
├── OperatorWarning.tsx     # Counterparty-side red blocker (maker/winner missing auth)
├── NftReceipt.tsx          # Single-click procedural SVG + onchain ERC-721 mint
└── ...                     # Skeleton, Toast, Tooltip, EmptyState, etc.

lib/
├── wagmi.ts                # Contract addresses (PrivateOTC, cUSDC, cETH, TradiNoxReceipt)
├── handle-client.ts       # Encryption SDK wrapper
├── receipt-svg.ts           # Client-side SVG receipt generator
├── abi/                    # Typed contract ABIs (privateOtc, etc.)
└── hooks/
    ├── useIntents.ts           # Browse rows
    ├── useOtcWrites.ts         # createIntent/Accept/Bid/Cancel/Finalize/Reveal
    ├── useSetOperator.ts       # Self-side setOperator + read isOperator
    ├── useIsOperator           # (named export) read-only counterparty check
    ├── useSettledTaker.ts      # Resolve settlement taker from Settled event log
    ├── useReceiptMint.ts       # TradiNoxReceipt.mint write
    └── useExistingReceipt.ts   # Idempotency: read past ReceiptMinted events
```

## Conventions

- **Server Components by default.** Add `"use client"` only when needed (wallet, hooks, animation, state).
- **Tailwind v4:** theme tokens in `globals.css` via `@theme {}`. Use `var(--color-*)` directly in className — NOT old `bg-{color}` shorthand for custom colors.
- **Numbers:** add `data-numeric` or `font-mono` for tabular-nums alignment.
- **Imports:** path alias `@/*` maps to package root (e.g., `@/lib/wagmi`).
- **Forms:** prefer Server Actions for non-wallet ops, client components for wallet sigs.
- **Encrypted inputs:** ALWAYS encrypt off-chain via `handle-client.encryptInput()` before passing to contract write.

## Environment Variables

Need `NEXT_PUBLIC_*` for client, others server-only:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID    # Reown/WC project id
NEXT_PUBLIC_PRIVATE_OTC_ADDRESS         # PrivateOTC orchestrator
NEXT_PUBLIC_CUSDC_ADDRESS               # cUSDC token address
NEXT_PUBLIC_CETH_ADDRESS                # cETH token address
NEXT_PUBLIC_TRADI_NOX_RECEIPT_ADDRESS        # TradiNoxReceipt ERC-721
NEXT_PUBLIC_NOX_NETWORK                 # arbitrum-sepolia
NEXT_PUBLIC_NOX_HANDLE_GATEWAY_URL      # Nox gateway endpoint

```

## How to run

```bash
pnpm install                # at workspace root
pnpm dev                    # Next dev with Turbopack on http://localhost:3000
pnpm build                  # production build
pnpm type-check             # tsc --noEmit
pnpm lint                   # next lint
```

## Design System

- **Source of truth:** `../../design-system/tradi-nox/MASTER.md`
- **Theme:** flat black institutional canvas with a single violet product accent
- **Primary:** `--color-primary` `#482BFF`; green is reserved for success status
- **Backgrounds:** `#000000` canvas, `#101012` surface, `#17171B` raised surface
- **Text:** `#F7F7F8` foreground and `#A1A1AA` secondary; maintain WCAG AA contrast
- **Fonts:** Space Grotesk (display), Inter (UI), JetBrains Mono (amounts, hashes, addresses, tables)
- **Shape:** pill actions and chips; 16–20px cards, fields, dialogs, and transaction panels
- **Motion:** feedback only, transform/opacity at 200ms maximum, with reduced-motion support
- **Icons:** Lucide for product UI. Material Symbols remain scoped to `/slides` only.
- **Exception:** `/slides` intentionally keeps its presentation-specific legacy theme.

## Don't

- DON'T expose private keys client-side
- DON'T render user balances without `<DecryptableBalance>` wrapper
- DON'T use `any` — strict mode is enabled
- DON'T fetch encrypted values in Server Components — they need wallet sig
- DON'T call hooks after early returns. `useReadContract`, `useSetOperator`,
  `useSettledTaker` etc. must sit above any `if (loading) return` branch —
  hooks tolerate undefined inputs via internal `enabled` guards. Past
  bug: react error #310 from /intents/[id] and /rfq/[id]; fix was moving
  hooks above the intentQuery loading branch.

## Mint flow contract (NftReceipt)

Single-click "MINT RECEIPT" does two things in sequence:
1. `generateReceiptSvg(props)` → preview SVG (client-side, no API call).
2. `useReceiptMint().submit(...)` → `TradiNoxReceipt.mint(intentId, mode,
   settleTxHash, pair)` → ERC-721 to caller's wallet.

Both happen in a single click. No server-side API needed.

Idempotency: `useExistingReceipt(intentId, address)` reads
`ReceiptMinted` events filtered by the (intentId, minter) topic pair.
If a receipt already exists, the button is hidden and the panel shows
a "MINTED #N" link to Arbiscan instead. After a fresh mint commits,
the hook's `refresh()` is called to reflect the new tokenId without
a page reload.

Participant gating: receipt mint UI only renders if connected wallet is
maker, OR Settled event taker (from `useSettledTaker`), OR the active
session just settled (`accept.step === "done"` / `reveal.step === "done"`).
Random visitors see "Read-only view" notice.
