/**
 * Multi-maker seed — funds 3 test wallets from deployer, each creates 1 intent.
 * After running, user (any wallet) can ACCEPT/BID on intents from these makers
 * since the makers are different addresses than the user.
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents seed-multi
 *
 * Test wallet keys derived deterministically from labels — consistent addresses
 * across runs. Funded with 0.005 ETH each from deployer.
 */

import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseEther,
  parseAbi,
  decodeEventLog,
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
  ceth: process.env.NEXT_PUBLIC_CETH_ADDRESS as `0x${string}`,
};
if (!ADDRESSES.privateOtc || !ADDRESSES.cusdc || !ADDRESSES.ceth) {
  throw new Error("Set NEXT_PUBLIC_*_ADDRESS env vars");
}

const cTokenAbi = parseAbi([
  "function faucet(bytes32 amountHandle, bytes amountProof)",
  "function setOperator(address operator, uint48 until)",
]);

const otcAbi = parseAbi([
  "function createIntent(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, bytes32 minBuyAmountHandle, bytes minBuyProof, uint64 deadline, address allowedTaker) returns (uint256)",
  "function createRFQ(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, uint64 biddingDeadline) returns (uint256)",
  "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)",
]);

// Deterministic test wallets — derived from labels via keccak256
const seedKey = (label: string) =>
  keccak256(stringToBytes(`tradi-nox-demo-${label}`)) as `0x${string}`;

interface Maker {
  name: string;
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  intent: () => Promise<void>;
}

async function main() {
  const adminKey = process.env.PRIVATE_KEY;
  if (!adminKey || !/^0x[a-fA-F0-9]{64}$/.test(adminKey)) {
    throw new Error("PRIVATE_KEY (deployer/funder) required");
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

  console.log("[seed-multi] funder:", adminAccount.address);
  const adminBalance = await publicClient.getBalance({ address: adminAccount.address });
  console.log("[seed-multi] funder balance:", formatEther(adminBalance), "ETH");

  // Setup 3 test makers
  const makers: { name: string; key: `0x${string}`; intent: "ETH→USDC" | "USDC→ETH" | "RFQ" }[] = [
    { name: "Alice", key: seedKey("alice"), intent: "ETH→USDC" },
    { name: "Bob", key: seedKey("bob"), intent: "USDC→ETH" },
    { name: "Carol", key: seedKey("carol"), intent: "RFQ" },
  ];

  for (const m of makers) {
    const acc = privateKeyToAccount(m.key);
    console.log(`\n[seed-multi] ─── ${m.name}: ${acc.address} ───`);

    // 1. Check + fund ETH if needed
    const bal = await publicClient.getBalance({ address: acc.address });
    console.log(`  ETH balance: ${formatEther(bal)} ETH`);
    if (bal < parseEther("0.003")) {
      console.log(`  funding 0.005 ETH from admin…`);
      const fundTx = await adminWallet.sendTransaction({
        to: acc.address,
        value: parseEther("0.005"),
        chain: arbitrumSepolia,
        account: adminAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: fundTx });
      console.log(`  fund tx ${fundTx}`);
    }

    // 2. Set up wallet for this maker + Nox client
    const wallet = createWalletClient({
      account: acc,
      chain: arbitrumSepolia,
      transport: http(rpc),
    });
    const handleClient = await createViemHandleClient(wallet);

    // 3. Mint cUSDC + cETH
    console.log(`  mint cUSDC…`);
    await mint(handleClient, wallet, publicClient, ADDRESSES.cusdc, parseUnits("50000", 6));
    console.log(`  mint cETH…`);
    await mint(handleClient, wallet, publicClient, ADDRESSES.ceth, parseUnits("50", 18));

    // 4. setOperator on both
    const until = Math.floor(Date.now() / 1000) + 86400;
    console.log(`  setOperator(PrivateOTC, +24h)…`);
    const op1 = await wallet.writeContract({
      address: ADDRESSES.cusdc,
      abi: cTokenAbi,
      functionName: "setOperator",
      args: [ADDRESSES.privateOtc, until],
      chain: wallet.chain,
      account: wallet.account!,
    });
    await publicClient.waitForTransactionReceipt({ hash: op1 });
    const op2 = await wallet.writeContract({
      address: ADDRESSES.ceth,
      abi: cTokenAbi,
      functionName: "setOperator",
      args: [ADDRESSES.privateOtc, until],
      chain: wallet.chain,
      account: wallet.account!,
    });
    await publicClient.waitForTransactionReceipt({ hash: op2 });

    // 5. Create intent based on type
    if (m.intent === "ETH→USDC") {
      console.log(`  createIntent: 0.5 cETH → 1500 cUSDC (24h)…`);
      await createDirect(
        handleClient,
        wallet,
        publicClient,
        ADDRESSES.ceth,
        ADDRESSES.cusdc,
        parseUnits("0.5", 18),
        parseUnits("1500", 6),
        24 * 3600,
      );
    } else if (m.intent === "USDC→ETH") {
      console.log(`  createIntent: 2500 cUSDC → 0.7 cETH (12h)…`);
      await createDirect(
        handleClient,
        wallet,
        publicClient,
        ADDRESSES.cusdc,
        ADDRESSES.ceth,
        parseUnits("2500", 6),
        parseUnits("0.7", 18),
        12 * 3600,
      );
    } else {
      console.log(`  createRFQ: 1 cETH for cUSDC (4h Vickrey window)…`);
      await createRfq(
        handleClient,
        wallet,
        publicClient,
        ADDRESSES.ceth,
        ADDRESSES.cusdc,
        parseUnits("1", 18),
        4 * 3600,
      );
    }
  }

  console.log("\n[seed-multi] ✓ done. View: https://private-otc.vercel.app/intents");
  console.log("\nTest wallets (testnet only — fund / dev only):");
  for (const m of makers) {
    const acc = privateKeyToAccount(m.key);
    console.log(`  ${m.name.padEnd(8)} ${acc.address}`);
  }
}

async function mint(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: WalletClient,
  publicClient: PublicClient,
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
) {
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
      if (decoded.eventName === "IntentCreated") {
        console.log(`  intent #${decoded.args.id}`);
        return;
      }
    } catch {}
  }
}

async function createRfq(
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
  wallet: WalletClient,
  publicClient: PublicClient,
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: bigint,
  windowSeconds: number,
) {
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
      if (decoded.eventName === "IntentCreated") {
        console.log(`  RFQ #${decoded.args.id}`);
        return;
      }
    } catch {}
  }
}

main().catch((err) => {
  console.error("[seed-multi] failed:", err);
  process.exit(1);
});
