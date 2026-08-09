/**
 * 30-day demo seed — populates the deployed PrivateOTC with a diverse set
 * of intents and RFQ bids spread across the next 30 days, so judges
 * visiting https://private-otc.vercel.app can interact with rich state
 * for the entire judging window.
 *
 * Run: pnpm --filter agents tsx src/seed/seed-30d-demo.ts
 *
 * Pre-req: 6 deterministic demo wallets (alice/bob/carol/dave/eve/frank)
 * each funded with ~0.005 ETH on Arbitrum Sepolia. Run check-balances.ts
 * first to confirm. Deployer/admin only needed if a wallet must be topped up.
 *
 * What it creates (per run, additive — old intents stay in registry):
 *   6 Direct OTC intents with deadlines staggered +3d / +5d / +7d / +14d / +21d / +30d
 *   3 RFQ auctions with bidding deadlines +7d / +14d / +28d
 *   5 RFQ bids preloaded so 2 of the RFQs already show competitive bidding
 *
 * Token decimals: cUSDC=6, cETH=18.
 */
import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseUnits, parseEther, parseAbi, decodeEventLog, keccak256, stringToBytes, formatEther, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createViemHandleClient } from "../handle-client.js";
const ADDRESSES = {
    privateOtc: (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ??
        "0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4"),
    cusdc: (process.env.NEXT_PUBLIC_CUSDC_ADDRESS ??
        "0x57736B816F6cb53c6B2c742D3A162E89Db162ADE"),
    ceth: (process.env.NEXT_PUBLIC_CETH_ADDRESS ??
        "0xCdD84bA9415DFE3Dd5c0c05077B1FE194Bcf695d"),
};
const cTokenAbi = parseAbi([
    "function faucet(bytes32 amountHandle, bytes amountProof)",
    "function setOperator(address operator, uint48 until)",
    "function isOperator(address holder, address spender) view returns (bool)",
]);
const otcAbi = parseAbi([
    "function createIntent(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, bytes32 minBuyAmountHandle, bytes minBuyProof, uint64 deadline, address allowedTaker) returns (uint256)",
    "function createRFQ(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, uint64 biddingDeadline) returns (uint256)",
    "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
    "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)",
]);
const seedKey = (label) => keccak256(stringToBytes(`tradi-demo-${label}`));
const DAY = 86400;
const NOW = () => Math.floor(Date.now() / 1000);
const OPERATOR_EXPIRY = NOW() + 60 * DAY; // 60 days — covers all deadlines + buffer
async function makeWallet(name, rpc) {
    const acc = privateKeyToAccount(seedKey(name));
    const client = createWalletClient({
        account: acc,
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const handle = await createViemHandleClient(client);
    return { name, acc, client, handle };
}
async function ensureFunded(publicClient, wallet, adminWallet, minEth = parseEther("0.0015"), topUpEth = parseEther("0.003")) {
    const bal = await publicClient.getBalance({ address: wallet.acc.address });
    console.log(`  [${wallet.name}] balance ${formatEther(bal)} ETH`);
    if (bal >= minEth)
        return;
    if (!adminWallet) {
        throw new Error(`${wallet.name} balance too low (${formatEther(bal)} ETH) and no PRIVATE_KEY admin wallet available to top up`);
    }
    console.log(`  [${wallet.name}] topping up ${formatEther(topUpEth)} ETH from admin…`);
    const tx = await adminWallet.sendTransaction({
        to: wallet.acc.address,
        value: topUpEth,
        chain: arbitrumSepolia,
        account: adminWallet.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
}
async function mint(wallet, publicClient, token, amount, symbol) {
    console.log(`  [${wallet.name}] mint ${symbol}…`);
    const enc = await wallet.handle.encryptInput(amount, "uint256", token);
    const tx = await wallet.client.writeContract({
        address: token,
        abi: cTokenAbi,
        functionName: "faucet",
        args: [enc.handle, enc.handleProof],
        chain: wallet.client.chain,
        account: wallet.acc,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
}
async function setOperatorIfNeeded(wallet, publicClient, token, symbol) {
    const isOp = await publicClient.readContract({
        address: token,
        abi: cTokenAbi,
        functionName: "isOperator",
        args: [wallet.acc.address, ADDRESSES.privateOtc],
    });
    if (isOp) {
        console.log(`  [${wallet.name}] setOperator(${symbol}) skipped — already active`);
        return;
    }
    console.log(`  [${wallet.name}] setOperator(${symbol}, +60d)…`);
    const tx = await wallet.client.writeContract({
        address: token,
        abi: cTokenAbi,
        functionName: "setOperator",
        args: [ADDRESSES.privateOtc, OPERATOR_EXPIRY],
        chain: wallet.client.chain,
        account: wallet.acc,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
}
async function createDirectIntent(wallet, publicClient, sellToken, buyToken, sellAmount, minBuyAmount, deadlineSec, description) {
    console.log(`  [${wallet.name}] createIntent: ${description}`);
    const sell = await wallet.handle.encryptInput(sellAmount, "uint256", ADDRESSES.privateOtc);
    const minBuy = await wallet.handle.encryptInput(minBuyAmount, "uint256", ADDRESSES.privateOtc);
    const deadline = BigInt(NOW() + deadlineSec);
    const tx = await wallet.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "createIntent",
        args: [
            sellToken,
            buyToken,
            sell.handle,
            sell.handleProof,
            minBuy.handle,
            minBuy.handleProof,
            deadline,
            "0x0000000000000000000000000000000000000000",
        ],
        chain: wallet.client.chain,
        account: wallet.acc,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    for (const log of receipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "IntentCreated") {
                console.log(`    ✓ intent #${decoded.args.id}`);
                return decoded.args.id;
            }
        }
        catch { }
    }
    return null;
}
async function createRfqIntent(wallet, publicClient, sellToken, buyToken, sellAmount, windowSec, description) {
    console.log(`  [${wallet.name}] createRFQ: ${description}`);
    const sell = await wallet.handle.encryptInput(sellAmount, "uint256", ADDRESSES.privateOtc);
    const deadline = BigInt(NOW() + windowSec);
    const tx = await wallet.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "createRFQ",
        args: [
            sellToken,
            buyToken,
            sell.handle,
            sell.handleProof,
            deadline,
        ],
        chain: wallet.client.chain,
        account: wallet.acc,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    for (const log of receipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "IntentCreated") {
                console.log(`    ✓ RFQ #${decoded.args.id}`);
                return decoded.args.id;
            }
        }
        catch { }
    }
    return null;
}
async function submitBid(wallet, publicClient, rfqId, amount, description) {
    console.log(`  [${wallet.name}] bid ${description} on RFQ #${rfqId}…`);
    const enc = await wallet.handle.encryptInput(amount, "uint256", ADDRESSES.privateOtc);
    const tx = await wallet.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "submitBid",
        args: [rfqId, enc.handle, enc.handleProof],
        chain: wallet.client.chain,
        account: wallet.acc,
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`    ✓ bid tx ${tx}`);
}
async function main() {
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ??
        "https://sepolia-rollup.arbitrum.io/rpc";
    const adminKey = process.env.PRIVATE_KEY;
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const adminWallet = adminKey
        ? createWalletClient({
            account: privateKeyToAccount(adminKey),
            chain: arbitrumSepolia,
            transport: http(rpc),
        })
        : null;
    console.log("\n[seed-30d] PrivateOTC :", ADDRESSES.privateOtc);
    console.log("[seed-30d] cUSDC      :", ADDRESSES.cusdc);
    console.log("[seed-30d] cETH       :", ADDRESSES.ceth);
    console.log("[seed-30d] admin      :", adminWallet?.account?.address ?? "(none — funding skipped)");
    // ─── Setup all wallets ───
    console.log("\n[seed-30d] === setup wallets ===");
    const labels = ["alice", "bob", "carol", "dave", "eve", "frank"];
    const wallets = {};
    for (const l of labels) {
        wallets[l] = await makeWallet(l, rpc);
    }
    for (const l of labels) {
        const w = wallets[l];
        console.log(`\n[seed-30d] preparing ${l}…`);
        await ensureFunded(publicClient, w, adminWallet);
        await mint(w, publicClient, ADDRESSES.cusdc, parseUnits("100000", 6), "100000 cUSDC");
        await mint(w, publicClient, ADDRESSES.ceth, parseUnits("100", 18), "100 cETH");
        await setOperatorIfNeeded(w, publicClient, ADDRESSES.cusdc, "cUSDC");
        await setOperatorIfNeeded(w, publicClient, ADDRESSES.ceth, "cETH");
    }
    // ─── Direct OTC intents (6) — staggered deadlines ───
    console.log("\n[seed-30d] === Direct OTC intents ===");
    const directIds = [];
    directIds.push({
        label: "Alice 0.5 cETH → ≥1500 cUSDC (~$3000/ETH, 30d)",
        id: await createDirectIntent(wallets.alice, publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("0.5", 18), parseUnits("1500", 6), 30 * DAY, "0.5 cETH → 1500 cUSDC, 30d"),
    });
    directIds.push({
        label: "Bob 3000 cUSDC → ≥0.85 cETH (~$3529/ETH, 21d)",
        id: await createDirectIntent(wallets.bob, publicClient, ADDRESSES.cusdc, ADDRESSES.ceth, parseUnits("3000", 6), parseUnits("0.85", 18), 21 * DAY, "3000 cUSDC → 0.85 cETH, 21d"),
    });
    directIds.push({
        label: "Carol 2.0 cETH → ≥6000 cUSDC (~$3000/ETH, 14d)",
        id: await createDirectIntent(wallets.carol, publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("2.0", 18), parseUnits("6000", 6), 14 * DAY, "2.0 cETH → 6000 cUSDC, 14d"),
    });
    directIds.push({
        label: "Dave 10000 cUSDC → ≥2.5 cETH (~$4000/ETH, 7d, bullish)",
        id: await createDirectIntent(wallets.dave, publicClient, ADDRESSES.cusdc, ADDRESSES.ceth, parseUnits("10000", 6), parseUnits("2.5", 18), 7 * DAY, "10000 cUSDC → 2.5 cETH, 7d (bullish)"),
    });
    directIds.push({
        label: "Eve 0.25 cETH → ≥750 cUSDC (~$3000/ETH, 5d, small)",
        id: await createDirectIntent(wallets.eve, publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("0.25", 18), parseUnits("750", 6), 5 * DAY, "0.25 cETH → 750 cUSDC, 5d"),
    });
    directIds.push({
        label: "Frank 500 cUSDC → ≥0.13 cETH (~$3846/ETH, 3d, urgent)",
        id: await createDirectIntent(wallets.frank, publicClient, ADDRESSES.cusdc, ADDRESSES.ceth, parseUnits("500", 6), parseUnits("0.13", 18), 3 * DAY, "500 cUSDC → 0.13 cETH, 3d"),
    });
    // ─── RFQ auctions (3) ───
    console.log("\n[seed-30d] === RFQ auctions ===");
    const rfqIds = [];
    // RFQ A: Alice — long window, NO bids preloaded (judges can be first bidder)
    const rfqA = await createRfqIntent(wallets.alice, publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("1.5", 18), 28 * DAY, "1.5 cETH for cUSDC, 28d Vickrey window (no bids yet)");
    rfqIds.push({ label: "Alice 1.5 cETH (Vickrey, 28d, open for bids)", id: rfqA });
    // RFQ B: Bob — medium window, 3 bids preloaded for competitive demo
    const rfqB = await createRfqIntent(wallets.bob, publicClient, ADDRESSES.cusdc, ADDRESSES.ceth, parseUnits("5000", 6), 14 * DAY, "5000 cUSDC for cETH, 14d Vickrey window");
    rfqIds.push({ label: "Bob 5000 cUSDC (Vickrey, 14d, 3 bids preloaded)", id: rfqB });
    // RFQ C: Carol — short window, 2 bids preloaded
    const rfqC = await createRfqIntent(wallets.carol, publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("2.5", 18), 7 * DAY, "2.5 cETH for cUSDC, 7d Vickrey window");
    rfqIds.push({ label: "Carol 2.5 cETH (Vickrey, 7d, 2 bids preloaded)", id: rfqC });
    // ─── RFQ bids ───
    console.log("\n[seed-30d] === RFQ bids ===");
    // Bob's RFQ B (5000 cUSDC for cETH): Carol/Dave/Eve bid in cETH
    if (rfqB) {
        await submitBid(wallets.carol, publicClient, rfqB, parseUnits("1.40", 18), "1.40 cETH");
        await submitBid(wallets.dave, publicClient, rfqB, parseUnits("1.55", 18), "1.55 cETH (winner)");
        await submitBid(wallets.eve, publicClient, rfqB, parseUnits("1.50", 18), "1.50 cETH (2nd-price)");
    }
    // Carol's RFQ C (2.5 cETH for cUSDC): Frank/Alice bid in cUSDC
    if (rfqC) {
        await submitBid(wallets.frank, publicClient, rfqC, parseUnits("7000", 6), "7000 cUSDC (2nd-price)");
        await submitBid(wallets.alice, publicClient, rfqC, parseUnits("7800", 6), "7800 cUSDC (winner)");
    }
    // ─── Summary ───
    console.log("\n[seed-30d] ═════════════════════════════════════════════");
    console.log("[seed-30d] ✓ done — judges have rich state to interact with for 30d");
    console.log("[seed-30d] ═════════════════════════════════════════════\n");
    console.log("Direct OTC intents created:");
    for (const it of directIds) {
        console.log(`  #${it.id ?? "?"}  ${it.label}`);
    }
    console.log("\nRFQ auctions created:");
    for (const it of rfqIds) {
        console.log(`  #${it.id ?? "?"}  ${it.label}`);
    }
    console.log("\nDemo wallets:");
    for (const l of labels) {
        console.log(`  ${l.padEnd(8)} ${wallets[l].acc.address}`);
    }
    console.log("\nVisit: https://private-otc.vercel.app/intents");
    console.log("RFQ list: https://private-otc.vercel.app/intents?mode=rfq\n");
}
main().catch((err) => {
    console.error("[seed-30d] failed:", err);
    process.exit(1);
});
//# sourceMappingURL=seed-30d-demo.js.map