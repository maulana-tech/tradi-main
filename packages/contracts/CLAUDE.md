# Contracts Package — PrivateOTC

## Stack

- **Language:** Solidity `^0.8.27`
- **Build:** Foundry (`forge`)
- **Library:** `@iexec-nox/nox-protocol-contracts` for confidential ops, OpenZeppelin for ERC-721 + utils (Strings, Base64)

## Structure

```
src/
├── PrivateOTC.sol              # Main orchestrator (Direct OTC + RFQ Vickrey)
├── TradiNoxReceipt.sol             # ERC-721 trade receipt with fully onchain SVG metadata
├── interfaces/
│   ├── IPrivateOTC.sol         # External interface
│   ├── IERC7984.sol            # Confidential fungible token interface
│   └── IERC7984Receiver.sol    # ERC-7984 receiver callback (transferAndCall)
└── tokens/
    └── TradiNoxCToken.sol          # ERC-7984 confidential token (cUSDC, cETH)

test/                            # Foundry tests (local + fork)
script/
├── Deploy.s.sol                # Original PrivateOTC + cTokens deploy
└── DeployReceipt.s.sol         # Standalone TradiNoxReceipt deploy
```

### TradiNoxReceipt.sol — onchain ERC-721 keepsake

- Open mint at the contract level: `mint(uint256 intentId, Mode mode, bytes32 settleTxHash, bytes32 pair)`. Anyone can call; caller becomes owner. Frontend gates UX to actual participants.
- Multiple receipts per intent are allowed (e.g. maker + taker each mint their own copy).
- `tokenURI(tokenId)` returns `data:application/json;base64,...` containing JSON metadata + inline SVG image — no IPFS or off-chain host needed.
- SVG construction is split across `_svgHead`/`_svgBody` and `_buildJson` helpers to dodge `Stack too deep`. Each `abi.encodePacked` keeps under ~8 args.
- Emits `ReceiptMinted(uint256 indexed tokenId, uint256 indexed intentId, address indexed minter, Mode mode)` — the indexed (intentId, minter) pair lets the frontend cheap-check idempotency via `getLogs`.

## Key patterns

### Encrypted state initialization

`euint256` MUST be initialized via `Nox.toEuint256(0)` — unlike `uint256`, it does not default to zero.

```solidity
constructor() {
    sellAmount = Nox.toEuint256(0);
    Nox.allowThis(sellAmount);
}
```

### After every encrypted op, grant permissions

Every time you produce a new handle (add/sub/mul/select/etc.), you MUST grant access:

```solidity
balance = Nox.add(balance, amount);
Nox.allowThis(balance);          // contract can use it again
Nox.allow(balance, owner);        // owner can decrypt off-chain
```

### Branching on encrypted values

You can't use `if` on an `ebool`. Use `Nox.select(cond, ifTrue, ifFalse)` instead.

### Vickrey loop pattern

```solidity
for (uint i = 1; i < bids.length; i++) {
    ebool isHigher = Nox.gt(candidate, highest);
    second = Nox.select(isHigher, highest, second);
    highest = Nox.select(isHigher, candidate, highest);
}
```

Cap iterations at ~10 to keep gas reasonable.

### Safe arithmetic

`add/sub/mul/div` are wrapping. For overflow detection without leaking via revert, use `safeAdd` etc. — they return `(ebool success, result)`.

## How to run

```bash
forge install                       # install lib deps (forge-std, OpenZeppelin)
forge build                          # compile
forge test -vvv                      # run tests verbose
forge test --gas-report              # gas profile

# Deploy PrivateOTC + cTokens
forge script script/Deploy.s.sol \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast --verify

# Deploy TradiNoxReceipt standalone (only needed if redeploying receipts)
forge script script/DeployReceipt.s.sol \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast --slow
```

## Deployed addresses (Arbitrum Sepolia)

| Contract | Address |
|---|---|
| PrivateOTC | `0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4` |
| cUSDC | `0x57736B816F6cb53c6B2c742D3A162E89Db162ADE` |
| cETH | `0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d` |
| TradiNoxReceipt | `0xE011E57ff89a9b1450551A7cE402b75c5Bd27B85` |

## Gotchas

- `Nox.select` loop iterations are expensive — cap RFQ bidders at 10
- `div` by zero returns `MAX` (no revert) — always check the denominator
- Limited types: only `euint16` / `euint256` (no `euint64`)
- `externalEuint256` + bytes proof must match — invalid proof = revert
- `_settleAtomic` requires BOTH parties to have `setOperator(this, until)` on their respective sides — see "Operator authorization invariant" in root CLAUDE.md
- Onchain SVG via `abi.encodePacked`: each arg = 1 stack slot. Beyond ~12 args you'll hit "Stack too deep". Split builders into helpers returning `bytes` and concat — see `_svgHead`/`_svgBody` in TradiNoxReceipt.sol
