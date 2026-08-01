# Security — PrivateOTC

## Coverage

```bash
# Local-only coverage (fast, ~5 sec)
forge coverage --no-match-contract 'Fork|Invariant' --report summary

# Full coverage including fork tests (~10 min — runs all encrypted ops)
forge coverage --fork-url $ARBITRUM_SEPOLIA_RPC_URL --no-match-contract Invariant --report summary
```

Local-only coverage is naturally low (~20% on PrivateOTC.sol) because most
state-changing functions call `Nox.fromExternal` / `Nox.transfer` etc. which
require the precompile. The fork test suite covers the remaining branches.

`VickreyAlgorithm.t.sol` exercises the price-tracking algorithm in pure
Solidity with 100% line/statement/branch/function coverage — that mirror
proves the encrypted version's correctness via line-by-line equivalence.

## Static analysis

Run Slither locally:

```bash
cd packages/contracts
slither src/ --config-file slither.config.json
```

CI runs Slither on every push (`crytic/slither-action@v0.4.0`, fails on
medium-severity findings unless explicitly suppressed).

## Slither findings — triage

As of the last submission build (April 2026), Slither produces 21 results
across 6 detector classes. Each is reviewed below.

### `reentrancy-benign` / `reentrancy-events` (10 findings)

**Locations:** `createIntent`, `createRFQ`, `submitBid`, `revealRFQWinner`,
`acceptIntent`, `_doTransfer`.

**Slither's complaint:** state writes (intent storage, balance updates,
event emission) happen *after* external calls (`Nox.fromExternal`,
`Nox.allow`, `Nox.transfer`).

**Analysis:** **Acceptable / false positive.** Every "external call" flagged
is to the Nox precompile (`NoxCompute` proxy at a fixed address determined
by chain id). The precompile:

1. Has a fixed, on-chain implementation deployed by the iExec team — not
   user-controlled
2. Performs only encrypted state updates and ACL bookkeeping — does not
   call back into arbitrary contracts
3. Cannot make a `call` to PrivateOTC during execution

Reentrancy requires an attacker-controlled callback. Since NoxCompute does
not invoke caller code, the standard CEI (checks-effects-interactions)
ordering is not strictly required here.

**If a future Nox upgrade adds caller-side callbacks**, the affected
functions should be reordered or guarded with `nonReentrant`. Until then,
the current ordering is intentional — placing `Nox.fromExternal` before the
struct write lets us pass the resulting handle by value into the struct
literal in one statement.

### `timestamp` (8 findings)

**Locations:** all deadline / operator-expiry comparisons.

**Slither's complaint:** miners can manipulate `block.timestamp` by ~15
seconds. Code that compares against `block.timestamp` is potentially
exploitable when sub-second precision matters.

**Analysis:** **Acceptable.** All comparisons are against deadlines
configured by the maker at human time-scales (hours, days). A miner can
shave at most ~15 seconds off a 1-hour bidding window; that's a 0.4%
manipulation, far below MEV / slippage tolerances in OTC venues.

### `unused-return` (3 findings)

`Nox.transfer` and `Nox.mint` return a `success` ebool that we discard:

```solidity
(, euint256 newBalance, euint256 newSupply) = Nox.mint(...);
```

**Analysis:** **Intentional.** The `success` flag is meaningful only for
overflow scenarios on encrypted arithmetic. For a `mint` to a fresh balance
or a `transfer` of arbitrary encrypted amounts, success is implicit in the
caller's intent — a failed `transfer` does NOT revert (per Nox semantics)
but yields a zero-amount no-op. We rely on this as part of Strategy B for
RFQ no-ops without revert leakage.

## Threat model

| Threat | Mitigation |
|---|---|
| Maker leaks bid amounts via revert | Strategy B: encrypted `select` route both real + zero amounts; status always `Filled` |
| MEV extraction via mempool watching | Amounts are encrypted; MEV bots see only opaque bytes32 handles |
| Front-running RFQ finalize | Anyone can call `finalizeRFQ` after deadline; pricing is encrypted, no order-of-finalization advantage |
| Maker reveals wrong winner | Honor system. Maker has weak incentive (encrypted second-price unchanged regardless of who they pick); future Nox `eaddress` support will enable on-chain verification |
| Replay of encrypted handle | `Nox.fromExternal` validates a per-handle proof with EIP-712 signature + creation timestamp |
| Stale operator authorization | `setOperator(addr, until)` self-expires at `block.timestamp > until` |
| Bid spam → DoS finalize | Hard cap `MAX_BIDS_PER_RFQ = 10` to bound the gas cost of `_computeSecondPrice`'s O(n) loop |

## Known limitation: Vickrey winner address

`PrivateOTC._computeSecondPrice` correctly computes the encrypted
second-highest price across all bids. However, **the winner address is
chosen off-chain by the maker** via `revealRFQWinner(id, winnerIdx)`.
Reason: Nox v0.2 doesn't yet support `eaddress` (encrypted address type),
so we cannot return the encrypted-comparison loop's winning index as a
plain value without leaking the bid ordering.

The maker has weak game-theoretic incentive to misreport (price they
receive is fixed by the encrypted second-price), and reputation/social
cost makes off-chain cheating expensive. Future Nox versions with `eaddress`
will let us close this gap. See `CHANGELOG.md` for the full rationale.

## Reporting

Found a vulnerability? Email security@tradi-nox.fun (or open a private issue).
Hackathon-scale incentives are reputational.
