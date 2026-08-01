/**
 * Seed script — populate Tradi-Nox with real on-chain intents for demo.
 *
 * Run from repo root:
 *   PRIVATE_KEY=0x... pnpm --filter agents seed
 *
 * Creates:
 *   1. Mint 100k cUSDC + 100 cETH to deployer
 *   2. setOperator(PrivateOTC, +24h) on both tokens
 *   3. Direct OTC intent — sell 1 cETH for min 3000 cUSDC
 *   4. Direct OTC intent — sell 5000 cUSDC for min 1.4 cETH
 *   5. RFQ — sell 2 cETH for cUSDC, 6h bidding window
 */

import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseAbi,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createViemHandleClient } from "@iexec-nox/handle";

// Read from env so the same script works across redeploys.
const ADDRESSES = {
  privateOtc: process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS as `0x${string}`,
  cusdc: process.env.NEXT_PUBLIC_CUSDC_ADDRESS as `0x${string}`,
  ceth: process.env.NEXT_PUBLIC_CETH_ADDRESS as `0x${string}`,
};
if (!ADDRESSES.privateOtc || !ADDRESSES.cusdc || !ADDRESSES.ceth) {
  throw new Error(
    "Set NEXT_PUBLIC_PRIVATE_OTC_ADDRESS, NEXT_PUBLIC_CUSDC_ADDRESS, NEXT_PUBLIC_CETH_ADDRESS in .env",
  );
}

const cTokenAbi = parseAbi([
  "function faucet(bytes32 amountHandle, bytes amountProof)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function symbol() view returns (string)",
]);

const otcAbi = parseAbi([
  "function createIntent(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, bytes32 minBuyAmountHandle, bytes minBuyProof, uint64 deadline, address allowedTaker) returns (uint256)",
  "function createRFQ(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, uint64 biddingDeadline) returns (uint256)",
  "function nextIntentId() view returns (uint256)",
  "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)",
]);

async function main() {
  const key = process.env.PRIVATE_KEY;
  if (!key || !/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("PRIVATE_KEY missing or invalid format (expected 0x + 64 hex)");
  }

  const account = privateKeyToAccount(key as `0x${string}`);
  const rpc =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ??
    "https://sepolia-rollup.arbitrum.io/rpc";

  const wallet = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });

  const handleClient = await createViemHandleClient(wallet);

  console.log("[seed] connected as", account.address);
  console.log("[seed] PrivateOTC:", ADDRESSES.privateOtc);

  /* ──── Step 1: Mint cUSDC + cETH ──────────────────────── */
  console.log("\n[seed] (1/5) minting 100,000 cUSDC…");
  await mint(handleClient, wallet, publicClient, ADDRESSES.cusdc, parseUnits("100000", 6));

  console.log("[seed] (2/5) minting 100 cETH…");
  await mint(handleClient, wallet, publicClient, ADDRESSES.ceth, parseUnits("100", 18));

  /* ──── Step 2: setOperator on both ────────────────────── */
  const until = Math.floor(Date.now() / 1000) + 86400;
  console.log("[seed] (3/5) setOperator(PrivateOTC, +24h) on cUSDC + cETH…");
  const op1 = await wallet.writeContract({
    address: ADDRESSES.cusdc,
    abi: cTokenAbi,
    functionName: "setOperator",
    args: [ADDRESSES.privateOtc, until],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: op1 });
  console.log(`  cUSDC operator tx ${op1}`);

  const op2 = await wallet.writeContract({
    address: ADDRESSES.ceth,
    abi: cTokenAbi,
    functionName: "setOperator",
    args: [ADDRESSES.privateOtc, until],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: op2 });
  console.log(`  cETH operator tx ${op2}`);

  /* ──── Step 3-5: Create intents ───────────────────────── */
  console.log("\n[seed] (4/5) creating Direct OTC intent: 1 cETH → 3000 cUSDC…");
  await createDirect(
    handleClient,
    wallet,
    publicClient,
    ADDRESSES.ceth,
    ADDRESSES.cusdc,
    parseUnits("1", 18),
    parseUnits("3000", 6),
    24 * 3600,
  );

  console.log("[seed] creating Direct OTC intent: 5000 cUSDC → 1.4 cETH…");
  await createDirect(
    handleClient,
    wallet,
    publicClient,
    ADDRESSES.cusdc,
    ADDRESSES.ceth,
    parseUnits("5000", 6),
    parseUnits("1.4", 18),
    12 * 3600,
  );

  console.log("[seed] (5/5) creating RFQ: 2 cETH for cUSDC, 6h window…");
  await createRfq(
    handleClient,
    wallet,
    publicClient,
    ADDRESSES.ceth,
    ADDRESSES.cusdc,
    parseUnits("2", 18),
    6 * 3600,
  );

  const next = (await publicClient.readContract({
    address: ADDRESSES.privateOtc,
    abi: otcAbi,
    functionName: "nextIntentId",
  })) as bigint;
  console.log(`\n[seed] ✓ done. nextIntentId = ${next.toString()}`);
  console.log("[seed] view at https://private-otc.vercel.app/intents");
}

async function mint(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  token: `0x${string}`,
  amount: bigint,
) {
  const enc = await handleClient.encryptInput(amount, "uint256", token);
  const tx = await wallet.writeContract({
    address: token,
    abi: cTokenAbi,
    functionName: "faucet",
    args: [enc.handle as `0x${string}`, enc.handleProof as `0x${string}`],
    chain: wallet.chain,
    account: wallet.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`  tx ${tx}`);
}

async function createDirect(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: bigint,
  minBuyAmount: bigint,
  deadlineSeconds: number,
) {
  const sell = await handleClient.encryptInput(
    sellAmount,
    "uint256",
    ADDRESSES.privateOtc,
  );
  const minBuy = await handleClient.encryptInput(
    minBuyAmount,
    "uint256",
    ADDRESSES.privateOtc,
  );

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
      if (decoded.eventName === "IntentCreated") {
        console.log(`  intent #${decoded.args.id} tx ${tx}`);
        return;
      }
    } catch {}
  }
}

async function createRfq(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: bigint,
  windowSeconds: number,
) {
  const sell = await handleClient.encryptInput(
    sellAmount,
    "uint256",
    ADDRESSES.privateOtc,
  );
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
      if (decoded.eventName === "IntentCreated") {
        console.log(`  RFQ #${decoded.args.id} tx ${tx}`);
        return;
      }
    } catch {}
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
