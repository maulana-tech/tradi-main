/**
 * Bob-as-maker RFQ + 6 bidders. Lets the deployer demo as a BIDDER (not just
 * maker) on the live frontend. Run after the primary seeds — creates the
 * next available RFQ id (currently expected to be #7).
 *
 * Bid plan:
 *   Deployer 5400 · Alice 5800 · Carol 6200 · Dave 5500
 *   Eve 6700 (winner) · Frank 6100 · Grace 5900
 * Vickrey expectation: Eve wins, pays 6700 — wait, no. Eve highest,
 * Carol second at 6200 → Eve pays 6200.
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents exec tsx src/seed/seed-rfq-7.ts
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
  "function createRFQ(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, uint64 biddingDeadline) returns (uint256)",
  "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
  "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)",
]);

const seedKey = (label: string) =>
  keccak256(stringToBytes(`tradi-nox-demo-${label}`)) as `0x${string}`;

async function main() {
  const adminKey = process.env.PRIVATE_KEY;
  if (!adminKey || !/^0x[a-fA-F0-9]{64}$/.test(adminKey)) {
    throw new Error("PRIVATE_KEY required");
  }

  const rpc =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ??
    "https://sepolia-rollup.arbitrum.io/rpc";
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });

  // BOB creates the RFQ (so the deployer can bid as a participant).
  const bobAccount = privateKeyToAccount(seedKey("bob"));
  const bobWallet = createWalletClient({
    account: bobAccount,
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const bobHandle = await createViemHandleClient(bobWallet);

  console.log("[seed-rfq-7] maker (Bob):", bobAccount.address);
  console.log("[seed-rfq-7] PrivateOTC:", ADDRESSES.privateOtc);

  console.log("\n[seed-rfq-7] creating RFQ: 1.5 cETH for cUSDC (24h window)…");
  const sellEnc = await bobHandle.encryptInput(
    parseUnits("1.5", 18),
    "uint256",
    ADDRESSES.privateOtc,
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);

  const createTx = await bobWallet.writeContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "createRFQ",
    args: [
      ADDRESSES.ceth,
      ADDRESSES.cusdc,
      sellEnc.handle as `0x${string}`,
      sellEnc.handleProof as `0x${string}`,
      deadline,
    ],
    chain: bobWallet.chain,
    account: bobAccount,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: createTx });

  let rfqId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "IntentCreated") {
        rfqId = decoded.args.id;
        break;
      }
    } catch {}
  }
  if (rfqId === null) throw new Error("could not parse IntentCreated event");
  console.log(`  ✓ RFQ #${rfqId} tx ${createTx}`);

  /* ──── 7 bids from various wallets ──── */
  const bidPlan = [
    { name: "Deployer", key: adminKey as `0x${string}`, amount: parseUnits("5400", 6) },
    { name: "Alice", key: seedKey("alice"), amount: parseUnits("5800", 6) },
    { name: "Carol", key: seedKey("carol"), amount: parseUnits("6200", 6) },
    { name: "Dave", key: seedKey("dave"), amount: parseUnits("5500", 6) },
    { name: "Eve", key: seedKey("eve"), amount: parseUnits("6700", 6) }, // ← winner
    { name: "Frank", key: seedKey("frank"), amount: parseUnits("6100", 6) },
    { name: "Grace", key: seedKey("grace"), amount: parseUnits("5900", 6) },
  ];

  for (const plan of bidPlan) {
    const acc = privateKeyToAccount(plan.key);
    console.log(`\n[seed-rfq-7] ${plan.name} bids ${plan.amount} on RFQ #${rfqId}…`);

    const wallet = createWalletClient({
      account: acc,
      chain: arbitrumSepolia,
      transport: http(rpc),
    });
    const handle = await createViemHandleClient(wallet);
    const enc = await handle.encryptInput(
      plan.amount,
      "uint256",
      ADDRESSES.privateOtc,
    );

    try {
      const tx = await wallet.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "submitBid",
        args: [rfqId, enc.handle as `0x${string}`, enc.handleProof as `0x${string}`],
        chain: wallet.chain,
        account: acc,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`  ✓ tx ${tx}`);
    } catch (err) {
      console.error(
        `  ✗ submitBid failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `\n[seed-rfq-7] ✓ done.\n  Maker: Bob (${bobAccount.address})\n  RFQ:   https://private-otc.vercel.app/rfq/${rfqId}\n  Vickrey expectation: Eve wins (6700), pays 6200 (Carol's second-price)\n`,
  );
}

main().catch((err) => {
  console.error("[seed-rfq-7] failed:", err);
  process.exit(1);
});
