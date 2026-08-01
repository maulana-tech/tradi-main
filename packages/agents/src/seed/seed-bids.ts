/**
 * Seed bids — places sealed bids on open RFQs from various wallets.
 * After this runs, RFQ pages show populated bid lists ready for finalize.
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents seed-bids
 */

import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseAbi,
  keccak256,
  stringToBytes,
  formatEther,
  type WalletClient,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";

const ADDRESSES = {
  privateOtc: process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS as `0x${string}`,
  cusdc: process.env.NEXT_PUBLIC_CUSDC_ADDRESS as `0x${string}`,
};
if (!ADDRESSES.privateOtc || !ADDRESSES.cusdc) {
  throw new Error("Set NEXT_PUBLIC_*_ADDRESS env vars");
}

const otcAbi = parseAbi([
  "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
  "function intents(uint256) view returns (address maker, address sellToken, address buyToken, bytes32 sellAmount, bytes32 minBuyAmount, uint64 deadline, uint8 status, uint8 mode, address allowedTaker, bytes32 priceToPay)",
]);

const seedKey = (label: string) =>
  keccak256(stringToBytes(`tradi-nox-demo-${label}`)) as `0x${string}`;

interface BidPlan {
  rfqId: bigint;
  bidder: string;
  bidderKey: `0x${string}`;
  amount: bigint; // raw cUSDC
}

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

  // Bid plan — varied amounts so Vickrey winner is interesting.
  // Targets the 2 newest open RFQs created by `seed` + `seed-multi`.
  const bids: BidPlan[] = [
    // RFQ #8 (deployer's, 2 cETH for cUSDC, 6h window)
    // Bob has the highest (6500), Carol second (6200) → second-price = 6200
    { rfqId: 8n, bidder: "Alice", bidderKey: seedKey("alice"), amount: parseUnits("5800", 6) },
    { rfqId: 8n, bidder: "Bob",   bidderKey: seedKey("bob"),   amount: parseUnits("6500", 6) },
    { rfqId: 8n, bidder: "Carol", bidderKey: seedKey("carol"), amount: parseUnits("6200", 6) },

    // RFQ #11 (Carol's, 1 cETH for cUSDC, 4h window)
    // Bob has the highest (3500), Alice second (3300) → second-price = 3300
    { rfqId: 11n, bidder: "Deployer", bidderKey: adminKey as `0x${string}`, amount: parseUnits("3000", 6) },
    { rfqId: 11n, bidder: "Alice",    bidderKey: seedKey("alice"),          amount: parseUnits("3300", 6) },
    { rfqId: 11n, bidder: "Bob",      bidderKey: seedKey("bob"),            amount: parseUnits("3500", 6) },
  ];

  for (const plan of bids) {
    const acc = privateKeyToAccount(plan.bidderKey);
    const balance = await publicClient.getBalance({ address: acc.address });
    if (balance < parseUnits("0.001", 18)) {
      console.warn(
        `[seed-bids] ${plan.bidder} (${acc.address}) low ETH (${formatEther(balance)}), skipping`,
      );
      continue;
    }

    // Verify RFQ is open + not maker
    let intent;
    try {
      intent = (await publicClient.readContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "intents",
        args: [plan.rfqId],
      })) as readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        number,
        number,
        `0x${string}`,
        `0x${string}`,
      ];
    } catch (err) {
      console.warn(`[seed-bids] RFQ #${plan.rfqId} read failed`, err);
      continue;
    }

    const status = intent[6];
    const mode = intent[7];
    const maker = intent[0];
    const deadline = intent[5];

    if (status !== 0) {
      console.log(`[seed-bids] RFQ #${plan.rfqId} not open (status=${status}), skipping`);
      continue;
    }
    if (mode !== 1) {
      console.log(`[seed-bids] #${plan.rfqId} not RFQ (mode=${mode}), skipping`);
      continue;
    }
    if (deadline < BigInt(Math.floor(Date.now() / 1000))) {
      console.log(`[seed-bids] RFQ #${plan.rfqId} expired, skipping`);
      continue;
    }
    if (maker.toLowerCase() === acc.address.toLowerCase()) {
      console.log(`[seed-bids] ${plan.bidder} is maker of RFQ #${plan.rfqId}, skipping (cannot self-bid)`);
      continue;
    }

    console.log(
      `\n[seed-bids] ─── ${plan.bidder} bids on RFQ #${plan.rfqId} ───`,
    );
    console.log(`  ${acc.address} → bid ${plan.amount} (raw cUSDC)`);

    const wallet = createWalletClient({
      account: acc,
      chain: arbitrumSepolia,
      transport: http(rpc),
    });
    const handleClient = await createViemHandleClient(wallet);

    const enc = await handleClient.encryptInput(
      plan.amount,
      "uint256",
      ADDRESSES.privateOtc,
    );

    try {
      const tx = await wallet.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "submitBid",
        args: [
          plan.rfqId,
          enc.handle as `0x${string}`,
          enc.handleProof as `0x${string}`,
        ],
        chain: wallet.chain,
        account: wallet.account!,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`  ✓ tx ${tx}`);
    } catch (err) {
      console.error(`  ✗ submitBid failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    "\n[seed-bids] ✓ done. View RFQs:",
  );
  console.log("  https://private-otc.vercel.app/rfq/8");
  console.log("  https://private-otc.vercel.app/rfq/11");
}

main().catch((err) => {
  console.error("[seed-bids] failed:", err);
  process.exit(1);
});
