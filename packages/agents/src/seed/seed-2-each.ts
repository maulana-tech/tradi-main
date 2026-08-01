/**
 * Add 2 entries per status to the orderbook (12 new intents total):
 *   - 2× Open Direct
 *   - 2× Filled Direct
 *   - 2× Cancelled Direct
 *   - 2× Expired (short-deadline) Direct
 *   - 2× Open RFQ
 *   - 2× PendingReveal RFQ (with bids, awaiting maker reveal)
 *
 * Wallet pairings rotate across alice/bob/carol/dave/eve/frank so the
 * resulting orderbook looks organic — different makers per row, mixed
 * cETH↔cUSDC and cUSDC↔cETH directions, varied amounts.
 *
 * Idempotent in the sense that re-running just appends 12 more intents
 * (the contract uses an auto-incrementing intent id, so collisions are
 * impossible).
 *
 * Prerequisites:
 *   - Seed wallets funded with ETH + cTokens (run seed-multi.ts)
 *   - Seed wallets have setOperator(PrivateOTC, +60d) on both cTokens
 *     (run seed-authorize-operators.ts)
 *   - .env points to current PrivateOTC + cToken addresses
 *
 * Run:
 *   PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/seed-2-each.ts
 */

import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseAbi,
  decodeEventLog,
  keccak256,
  stringToBytes,
  type WalletClient,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";

const ADDRESSES = {
  privateOtc: process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS as `0x${string}`,
  cusdc: process.env.NEXT_PUBLIC_CUSDC_ADDRESS as `0x${string}`,
  ceth: process.env.NEXT_PUBLIC_CETH_ADDRESS as `0x${string}`,
};
if (!ADDRESSES.privateOtc || !ADDRESSES.cusdc || !ADDRESSES.ceth) {
  throw new Error("Set NEXT_PUBLIC_*_ADDRESS env vars");
}

const otcAbi = parseAbi([
  "function createIntent(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, bytes32 minBuyAmountHandle, bytes minBuyProof, uint64 deadline, address allowedTaker) returns (uint256)",
  "function createRFQ(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, uint64 biddingDeadline) returns (uint256)",
  "function acceptIntent(uint256 id, bytes32 buyAmountHandle, bytes buyProof)",
  "function cancelIntent(uint256 id)",
  "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
  "function finalizeRFQ(uint256 id)",
  "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)",
]);

const seedKey = (label: string) =>
  keccak256(stringToBytes(`tradi-nox-demo-${label}`)) as `0x${string}`;

function makeWallet(key: `0x${string}`, rpc: string) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  return { account, wallet };
}

async function createDirect(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: WalletClient,
  publicClient: PublicClient,
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: bigint,
  minBuyAmount: bigint,
  deadlineSeconds: number,
): Promise<bigint | null> {
  const sell = await handleClient.encryptInput(sellAmount, "uint256", ADDRESSES.privateOtc);
  const minBuy = await handleClient.encryptInput(minBuyAmount, "uint256", ADDRESSES.privateOtc);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const tx = await wallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "createIntent",
    args: [
      sellToken,
      buyToken,
      sell.handle as `0x${string}`,
      sell.handleProof as `0x${string}`,
      minBuy.handle as `0x${string}`,
      minBuy.handleProof as `0x${string}`,
      deadline,
      "0x0000000000000000000000000000000000000000",
    ],
    chain: wallet.chain,
    account: wallet.account!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "IntentCreated") return decoded.args.id as bigint;
    } catch {}
  }
  return null;
}

async function createRfq(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: WalletClient,
  publicClient: PublicClient,
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: bigint,
  windowSeconds: number,
): Promise<bigint | null> {
  const sell = await handleClient.encryptInput(sellAmount, "uint256", ADDRESSES.privateOtc);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + windowSeconds);
  const tx = await wallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "createRFQ",
    args: [
      sellToken,
      buyToken,
      sell.handle as `0x${string}`,
      sell.handleProof as `0x${string}`,
      deadline,
    ],
    chain: wallet.chain,
    account: wallet.account!,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "IntentCreated") return decoded.args.id as bigint;
    } catch {}
  }
  return null;
}

async function acceptDirect(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: WalletClient,
  publicClient: PublicClient,
  intentId: bigint,
  buyAmount: bigint,
) {
  const buy = await handleClient.encryptInput(buyAmount, "uint256", ADDRESSES.privateOtc);
  const tx = await wallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "acceptIntent",
    args: [intentId, buy.handle as `0x${string}`, buy.handleProof as `0x${string}`],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
}

async function cancel(
  wallet: WalletClient,
  publicClient: PublicClient,
  intentId: bigint,
) {
  const tx = await wallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "cancelIntent",
    args: [intentId],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
}

async function bid(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: WalletClient,
  publicClient: PublicClient,
  rfqId: bigint,
  amount: bigint,
) {
  const enc = await handleClient.encryptInput(amount, "uint256", ADDRESSES.privateOtc);
  const tx = await wallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "submitBid",
    args: [rfqId, enc.handle as `0x${string}`, enc.handleProof as `0x${string}`],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
}

async function finalize(
  wallet: WalletClient,
  publicClient: PublicClient,
  rfqId: bigint,
) {
  const tx = await wallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "finalizeRFQ",
    args: [rfqId],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
}

async function main() {
  const adminKey = process.env.PRIVATE_KEY;
  if (!adminKey || !/^0x[a-fA-F0-9]{64}$/.test(adminKey)) {
    throw new Error("PRIVATE_KEY (admin) required");
  }
  const rpc =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ??
    "https://sepolia-rollup.arbitrum.io/rpc";
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });

  const alice = makeWallet(seedKey("alice"), rpc);
  const bob = makeWallet(seedKey("bob"), rpc);
  const carol = makeWallet(seedKey("carol"), rpc);
  const dave = makeWallet(seedKey("dave"), rpc);
  const eve = makeWallet(seedKey("eve"), rpc);
  const frank = makeWallet(seedKey("frank"), rpc);

  const aliceHandle = await createViemHandleClient(alice.wallet);
  const bobHandle = await createViemHandleClient(bob.wallet);
  const carolHandle = await createViemHandleClient(carol.wallet);
  const daveHandle = await createViemHandleClient(dave.wallet);
  const eveHandle = await createViemHandleClient(eve.wallet);
  const frankHandle = await createViemHandleClient(frank.wallet);

  const ids: Record<string, bigint | null> = {};

  // ─────────── Phase 1: 2× Open Direct ───────────────────────────────
  console.log("[2x] 1/12 Open Direct — bob cETH→cUSDC 24h");
  ids.openA = await createDirect(
    bobHandle, bob.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.6", 18), parseUnits("1750", 6),
    24 * 3600,
  );
  console.log(`         → intent #${ids.openA}`);

  console.log("[2x] 2/12 Open Direct — carol cUSDC→cETH 12h");
  ids.openB = await createDirect(
    carolHandle, carol.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("5000", 6), parseUnits("1.4", 18),
    12 * 3600,
  );
  console.log(`         → intent #${ids.openB}`);

  // ─────────── Phase 2: 2× Filled Direct ─────────────────────────────
  console.log("[2x] 3/12 Filled Direct — dave cETH→cUSDC, eve accepts");
  ids.filledA = await createDirect(
    daveHandle, dave.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.8", 18), parseUnits("2400", 6),
    24 * 3600,
  );
  if (ids.filledA !== null) {
    await acceptDirect(eveHandle, eve.wallet, publicClient, ids.filledA, parseUnits("2700", 6));
    console.log(`         → intent #${ids.filledA} ✓ filled by eve`);
  }

  console.log("[2x] 4/12 Filled Direct — frank cUSDC→cETH, alice accepts");
  ids.filledB = await createDirect(
    frankHandle, frank.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("3500", 6), parseUnits("1.0", 18),
    24 * 3600,
  );
  if (ids.filledB !== null) {
    await acceptDirect(aliceHandle, alice.wallet, publicClient, ids.filledB, parseUnits("1.05", 18));
    console.log(`         → intent #${ids.filledB} ✓ filled by alice`);
  }

  // ─────────── Phase 3: 2× Cancelled Direct ──────────────────────────
  console.log("[2x] 5/12 Cancelled Direct — alice cETH→cUSDC, then cancels");
  ids.cancelledA = await createDirect(
    aliceHandle, alice.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("1.2", 18), parseUnits("3500", 6),
    24 * 3600,
  );
  if (ids.cancelledA !== null) {
    await cancel(alice.wallet, publicClient, ids.cancelledA);
    console.log(`         → intent #${ids.cancelledA} ✓ cancelled`);
  }

  console.log("[2x] 6/12 Cancelled Direct — bob cUSDC→cETH, then cancels");
  ids.cancelledB = await createDirect(
    bobHandle, bob.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("4000", 6), parseUnits("1.1", 18),
    24 * 3600,
  );
  if (ids.cancelledB !== null) {
    await cancel(bob.wallet, publicClient, ids.cancelledB);
    console.log(`         → intent #${ids.cancelledB} ✓ cancelled`);
  }

  // ─────────── Phase 4: 2× Expired Direct (short deadline) ───────────
  console.log("[2x] 7/12 Expired Direct — carol cETH→cUSDC, deadline 90s");
  ids.expiredA = await createDirect(
    carolHandle, carol.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.3", 18), parseUnits("950", 6),
    90,
  );
  console.log(`         → intent #${ids.expiredA} (reads as Expired in ~2min)`);

  console.log("[2x] 8/12 Expired Direct — dave cUSDC→cETH, deadline 60s");
  ids.expiredB = await createDirect(
    daveHandle, dave.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("1500", 6), parseUnits("0.4", 18),
    60,
  );
  console.log(`         → intent #${ids.expiredB} (reads as Expired in ~90s)`);

  // ─────────── Phase 5: 2× Open RFQ (no bids yet) ────────────────────
  console.log("[2x] 9/12 Open RFQ — eve cETH→cUSDC 1h window");
  ids.rfqOpenA = await createRfq(
    eveHandle, eve.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.7", 18),
    3600,
  );
  console.log(`         → rfq #${ids.rfqOpenA}`);

  console.log("[2x] 10/12 Open RFQ — frank cUSDC→cETH 2h window");
  ids.rfqOpenB = await createRfq(
    frankHandle, frank.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("6000", 6),
    7200,
  );
  console.log(`         → rfq #${ids.rfqOpenB}`);

  // ─────────── Phase 6: 2× PendingReveal RFQ (parallel deadlines) ────
  // Both RFQs created with same 30s window, all bids submitted, ONE
  // sleep, then finalize both. Halves the runtime vs. doing them
  // serially.
  console.log("[2x] 11/12 PendingReveal RFQ — alice cETH→cUSDC, bob+carol bid");
  ids.rfqPendingA = await createRfq(
    aliceHandle, alice.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.45", 18),
    30,
  );
  console.log(`         → rfq #${ids.rfqPendingA}`);

  console.log("[2x] 12/12 PendingReveal RFQ — bob cETH→cUSDC, dave+frank bid");
  ids.rfqPendingB = await createRfq(
    bobHandle, bob.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.55", 18),
    30,
  );
  console.log(`         → rfq #${ids.rfqPendingB}`);

  console.log("[2x]      submitting bids on both RFQs…");
  if (ids.rfqPendingA !== null) {
    await bid(bobHandle, bob.wallet, publicClient, ids.rfqPendingA, parseUnits("1500", 6));
    await bid(carolHandle, carol.wallet, publicClient, ids.rfqPendingA, parseUnits("1650", 6));
    console.log(`         #${ids.rfqPendingA}: bob 1500 + carol 1650`);
  }
  if (ids.rfqPendingB !== null) {
    await bid(daveHandle, dave.wallet, publicClient, ids.rfqPendingB, parseUnits("1850", 6));
    await bid(frankHandle, frank.wallet, publicClient, ids.rfqPendingB, parseUnits("2000", 6));
    console.log(`         #${ids.rfqPendingB}: dave 1850 + frank 2000`);
  }

  console.log("[2x]      waiting for bidding deadline (~35s)…");
  await new Promise((r) => setTimeout(r, 35_000));

  console.log("[2x]      finalizing both RFQs…");
  if (ids.rfqPendingA !== null) {
    await finalize(alice.wallet, publicClient, ids.rfqPendingA);
    console.log(`         ✓ #${ids.rfqPendingA} → PendingReveal (alice can reveal)`);
  }
  if (ids.rfqPendingB !== null) {
    await finalize(bob.wallet, publicClient, ids.rfqPendingB);
    console.log(`         ✓ #${ids.rfqPendingB} → PendingReveal (bob can reveal)`);
  }

  // ─────────── Summary ───────────────────────────────────────────────
  console.log("\n[2x] Done. Browse: https://private-otc.vercel.app/intents\n");
  console.log("Summary:");
  console.log(`  Open Direct        #${ids.openA}, #${ids.openB}`);
  console.log(`  Filled Direct      #${ids.filledA}, #${ids.filledB}`);
  console.log(`  Cancelled Direct   #${ids.cancelledA}, #${ids.cancelledB}`);
  console.log(`  Expired Direct     #${ids.expiredA}, #${ids.expiredB}`);
  console.log(`  Open RFQ           #${ids.rfqOpenA}, #${ids.rfqOpenB}`);
  console.log(`  PendingReveal RFQ  #${ids.rfqPendingA}, #${ids.rfqPendingB}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
