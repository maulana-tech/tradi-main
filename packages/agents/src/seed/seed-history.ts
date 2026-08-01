/**
 * Populate Activity history — produces one Cancelled + one Filled intent
 * so the deployer's /activity tab has real lifecycle entries beyond just
 * "Open".
 *
 * Actions:
 *   1. Deployer cancels intent #2 (their unused RFQ) → status: Cancelled
 *   2. Alice accepts deployer's intent #0 (1 cETH → 3000 cUSDC)
 *      → status: Filled. Alice provides 3000+ cUSDC, receives 1 cETH.
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents exec tsx src/seed/seed-history.ts
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
  "function cancelIntent(uint256 id)",
  "function acceptIntent(uint256 id, bytes32 buyAmountHandle, bytes buyProof)",
  "function intents(uint256) view returns (address maker, address sellToken, address buyToken, bytes32 sellAmount, bytes32 minBuyAmount, uint64 deadline, uint8 status, uint8 mode, address allowedTaker, bytes32 priceToPay)",
]);

const cTokenAbi = parseAbi([
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
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

  console.log("[seed-history] deployer:", adminAccount.address);

  /* ──── Step 1: Cancel deployer's intent #2 ──── */
  console.log("\n[seed-history] (1/2) cancelling deployer's intent #2 (RFQ, no bids)…");
  try {
    // Confirm it's still Open + maker == deployer
    const intent2 = (await publicClient.readContract({
      address: ADDRESSES.privateOtc,
      abi: otcAbi,
      functionName: "intents",
      args: [2n],
    })) as readonly [
      `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`,
      bigint, number, number, `0x${string}`, `0x${string}`
    ];
    if (intent2[6] !== 0) {
      console.log(`  ⚠ intent #2 status=${intent2[6]} (not Open) — skip`);
    } else if (intent2[0].toLowerCase() !== adminAccount.address.toLowerCase()) {
      console.log(`  ⚠ intent #2 maker=${intent2[0]} (not deployer) — skip`);
    } else {
      const tx = await adminWallet.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "cancelIntent",
        args: [2n],
        chain: adminWallet.chain,
        account: adminAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`  ✓ cancel tx ${tx}`);
    }
  } catch (err) {
    console.error(`  ✗`, err instanceof Error ? err.message.split("\n")[0] : err);
  }

  /* ──── Step 2: Alice accepts deployer's #0 (1 cETH → 3000 cUSDC) ──── */
  console.log("\n[seed-history] (2/2) Alice accepts deployer's intent #0 (1 cETH → 3000 cUSDC)…");
  const aliceAccount = privateKeyToAccount(seedKey("alice"));
  const aliceWallet = createWalletClient({
    account: aliceAccount,
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const aliceHandle = await createViemHandleClient(aliceWallet);

  try {
    // Confirm intent #0 is still Open
    const intent0 = (await publicClient.readContract({
      address: ADDRESSES.privateOtc,
      abi: otcAbi,
      functionName: "intents",
      args: [0n],
    })) as readonly [
      `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`,
      bigint, number, number, `0x${string}`, `0x${string}`
    ];
    if (intent0[6] !== 0) {
      console.log(`  ⚠ intent #0 status=${intent0[6]} (not Open) — skip`);
      return;
    }

    // Alice needs operator on cUSDC (paying side). Verify + set if needed.
    const isOp = (await publicClient.readContract({
      address: ADDRESSES.cusdc,
      abi: cTokenAbi,
      functionName: "isOperator",
      args: [aliceAccount.address, ADDRESSES.privateOtc],
    })) as boolean;
    if (!isOp) {
      console.log("  Alice setOperator(PrivateOTC) on cUSDC…");
      const opTx = await aliceWallet.writeContract({
        address: ADDRESSES.cusdc,
        abi: cTokenAbi,
        functionName: "setOperator",
        args: [ADDRESSES.privateOtc, Math.floor(Date.now() / 1000) + 86400],
        chain: aliceWallet.chain,
        account: aliceAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: opTx });
    }

    // Encrypt buy amount = 3500 cUSDC (above the maker's hidden minimum 3000)
    const buyEnc = await aliceHandle.encryptInput(
      parseUnits("3500", 6),
      "uint256",
      ADDRESSES.privateOtc,
    );

    const acceptTx = await aliceWallet.writeContract({
      address: ADDRESSES.privateOtc,
      abi: otcAbi,
      functionName: "acceptIntent",
      args: [
        0n,
        buyEnc.handle as `0x${string}`,
        buyEnc.handleProof as `0x${string}`,
      ],
      chain: aliceWallet.chain,
      account: aliceAccount,
    });
    await publicClient.waitForTransactionReceipt({ hash: acceptTx });
    console.log(`  ✓ accept tx ${acceptTx}`);
  } catch (err) {
    console.error(`  ✗`, err instanceof Error ? err.message.split("\n")[0] : err);
  }

  console.log(
    `\n[seed-history] ✓ done. View deployer's activity:\n  https://private-otc.vercel.app/activity\n`,
  );
}

main().catch((err) => {
  console.error("[seed-history] failed:", err);
  process.exit(1);
});
