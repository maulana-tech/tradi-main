/**
 * Populate /intents with a representative mix of statuses for the demo:
 *   - Open Direct (alice creating, untouched)
 *   - Filled Direct (bob creates, carol accepts)
 *   - Cancelled Direct (dave creates, dave cancels)
 *   - Soon-Expired Direct (eve creates with 90s deadline)
 *   - Open RFQ (frank creates, no bids yet)
 *   - PendingReveal RFQ (alice creates, bob+carol bid, finalized after window)
 *
 * Assumes the deterministic seed wallets (alice/bob/carol/dave/eve/frank)
 * are already funded with ETH, cToken balance, and have setOperator
 * authorized — see seed-multi.ts and seed-authorize-operators.ts.
 *
 * Run:
 *   PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/seed-mixed-statuses.ts
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

  // 1. Open Direct — alice cETH → cUSDC, 24h
  console.log("[mix] 1/6 Open Direct — alice cETH→cUSDC 24h");
  const openId = await createDirect(
    aliceHandle, alice.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.4", 18), parseUnits("1200", 6),
    24 * 3600,
  );
  console.log(`     → intent #${openId}`);

  // 2. Filled Direct — bob cUSDC → cETH, carol accepts above the hidden min
  console.log("[mix] 2/6 Filled Direct — bob cUSDC→cETH 24h, carol accepts");
  const filledId = await createDirect(
    bobHandle, bob.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("2000", 6), parseUnits("0.5", 18),
    24 * 3600,
  );
  console.log(`     → intent #${filledId}, carol accepting…`);
  if (filledId !== null) {
    await acceptDirect(carolHandle, carol.wallet, publicClient, filledId, parseUnits("0.65", 18));
    console.log(`     ✓ filled`);
  }

  // 3. Cancelled Direct — dave creates then cancels
  console.log("[mix] 3/6 Cancelled Direct — dave cUSDC→cETH 24h, then cancels");
  const cancelledId = await createDirect(
    daveHandle, dave.wallet, publicClient,
    ADDRESSES.cusdc, ADDRESSES.ceth,
    parseUnits("3500", 6), parseUnits("1.0", 18),
    24 * 3600,
  );
  console.log(`     → intent #${cancelledId}, dave cancelling…`);
  if (cancelledId !== null) {
    await cancel(dave.wallet, publicClient, cancelledId);
    console.log(`     ✓ cancelled`);
  }

  // 4. Soon-expired Direct — eve, 90s deadline (UI marks as Expired in <2min)
  console.log("[mix] 4/6 Soon-expired Direct — eve cETH→cUSDC, deadline 90s");
  const expiredId = await createDirect(
    eveHandle, eve.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.25", 18), parseUnits("750", 6),
    90,
  );
  console.log(`     → intent #${expiredId} (will read as Expired in ~2min)`);

  // 5. Open RFQ — frank, 1h window, no bids
  console.log("[mix] 5/6 Open RFQ — frank cETH→cUSDC 1h auction window");
  const rfqOpenId = await createRfq(
    frankHandle, frank.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.6", 18),
    3600,
  );
  console.log(`     → rfq #${rfqOpenId}`);

  // 6. PendingReveal RFQ — alice opens with 30s window, bob+carol bid,
  // wait for deadline, anyone calls finalizeRFQ → PendingReveal status
  console.log("[mix] 6/6 PendingReveal RFQ — alice 30s window, bob+carol bid, finalize");
  const rfqPendingId = await createRfq(
    aliceHandle, alice.wallet, publicClient,
    ADDRESSES.ceth, ADDRESSES.cusdc,
    parseUnits("0.5", 18),
    30,
  );
  console.log(`     → rfq #${rfqPendingId}, bob+carol bidding…`);
  if (rfqPendingId !== null) {
    await bid(bobHandle, bob.wallet, publicClient, rfqPendingId, parseUnits("1700", 6));
    await bid(carolHandle, carol.wallet, publicClient, rfqPendingId, parseUnits("1850", 6));
    console.log(`     waiting for deadline (~35s)…`);
    await new Promise((r) => setTimeout(r, 35_000));
    await finalize(alice.wallet, publicClient, rfqPendingId);
    console.log(`     ✓ finalized → PendingReveal (alice can decrypt + pick winner in UI)`);
  }

  console.log("\n[mix] Done. Browse: https://private-otc.vercel.app/intents");
  console.log("\nSummary:");
  console.log(`  #${openId}      Open Direct        alice cETH→cUSDC`);
  console.log(`  #${filledId}    Filled Direct      bob (filled by carol)`);
  console.log(`  #${cancelledId} Cancelled Direct   dave`);
  console.log(`  #${expiredId}   Expiring soon      eve (~2min from now)`);
  console.log(`  #${rfqOpenId}   Open RFQ           frank (1h window)`);
  console.log(`  #${rfqPendingId} PendingReveal RFQ alice (bob+carol bid)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
