/**
 * Fresh RFQ seed — creates a NEW RFQ from the deployer with a long window
 * AND seeds 3 bidders (Alice/Bob/Carol). Result: deployer can immediately
 * demo the 2-step reveal flow as MAKER (only the maker can call
 * revealRFQWinner).
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/seed-fresh-rfq.ts
 *
 * Bids:
 *   Alice → 5800 cUSDC
 *   Bob   → 6500 cUSDC  ← highest bidder (winner)
 *   Carol → 6200 cUSDC  ← second-highest (price the winner pays)
 *
 * Vickrey expectation: maker reveals Bob as winner, Bob pays 6200 cUSDC.
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
  privateOtc: (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ??
    "0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4") as `0x${string}`,
  cusdc: (process.env.NEXT_PUBLIC_CUSDC_ADDRESS ??
    "0x57736B816F6cb53c6B2c742D3A162E89Db162ADE") as `0x${string}`,
  ceth: (process.env.NEXT_PUBLIC_CETH_ADDRESS ??
    "0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d") as `0x${string}`,
};

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

  const adminAccount = privateKeyToAccount(adminKey as `0x${string}`);
  const adminWallet = createWalletClient({
    account: adminAccount,
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });

  console.log("[seed-fresh-rfq] PrivateOTC:", ADDRESSES.privateOtc);
  console.log("[seed-fresh-rfq] maker:", adminAccount.address);

  /* ──── Create fresh RFQ from deployer (24h window) ──── */
  const adminHandle = await createViemHandleClient(adminWallet);
  const sellAmount = parseUnits("2", 18); // 2 cETH
  const windowSec = 24 * 3600; // 24 hours

  console.log("\n[seed-fresh-rfq] creating RFQ: 2 cETH for cUSDC (24h window)…");
  const sellEnc = await adminHandle.encryptInput(
    sellAmount,
    "uint256",
    ADDRESSES.privateOtc,
  );
  const deadline = BigInt(Math.floor(Date.now() / 1000) + windowSec);

  const createTx = await adminWallet.writeContract({
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
    chain: adminWallet.chain,
    account: adminAccount,
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

  /* ──── Seed bids from Alice / Bob / Carol ──── */
  const bidPlan = [
    { name: "Alice", key: seedKey("alice"), amount: parseUnits("5800", 6) },
    { name: "Bob", key: seedKey("bob"), amount: parseUnits("6500", 6) }, // ← winner
    { name: "Carol", key: seedKey("carol"), amount: parseUnits("6200", 6) }, // ← second-price
  ];

  for (const plan of bidPlan) {
    const acc = privateKeyToAccount(plan.key);
    console.log(`\n[seed-fresh-rfq] ${plan.name} bids ${plan.amount} on RFQ #${rfqId}…`);

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
    `\n[seed-fresh-rfq] ✓ done.\n  Maker: ${adminAccount.address}\n  RFQ:   https://private-otc.vercel.app/rfq/${rfqId}\n  Bids:  Alice 5800 · Bob 6500 (winner) · Carol 6200 (second-price)\n`,
  );
}

main().catch((err) => {
  console.error("[seed-fresh-rfq] failed:", err);
  process.exit(1);
});
