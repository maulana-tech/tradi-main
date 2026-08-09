/**
 * Settled-state seed — produces FULLY EXECUTED trades so judges see
 * real audit-trail history on the Activity tab, not just open intents.
 *
 * Run: pnpm --filter agents tsx src/seed/seed-settled-examples.ts
 *
 * What it creates:
 *   1. Direct OTC #1: Alice 0.1 cETH → ≥300 cUSDC,  accepted by Frank → Filled
 *   2. Direct OTC #2: Bob 1500 cUSDC → ≥0.4 cETH,    accepted by Eve   → Filled
 *   3. RFQ end-to-end: Carol 0.5 cETH for cUSDC, 60-second window
 *      • Dave bids 1500 cUSDC
 *      • Frank bids 1620 cUSDC  ← winner (highest)
 *      • Alice bids 1580 cUSDC  ← second-price (the price Frank pays)
 *      → wait 65s for deadline
 *      → finalizeRFQ (status PendingReveal)
 *      → revealRFQWinner with Frank's bid index → Filled
 *
 * Prerequisites: 6 demo wallets (alice/bob/carol/dave/eve/frank) already
 * have setOperator(PrivateOTC) active on both cUSDC + cETH and have token
 * balance. Run seed-30d-demo.ts first if not.
 */
import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseUnits, parseAbi, decodeEventLog, keccak256, stringToBytes, } from "viem";
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
const otcAbi = parseAbi([
    "function createIntent(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, bytes32 minBuyAmountHandle, bytes minBuyProof, uint64 deadline, address allowedTaker) returns (uint256)",
    "function acceptIntent(uint256 id, bytes32 buyAmountHandle, bytes buyProof)",
    "function createRFQ(address sellToken, address buyToken, bytes32 sellAmountHandle, bytes sellProof, uint64 biddingDeadline) returns (uint256)",
    "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
    "function finalizeRFQ(uint256 id)",
    "function revealRFQWinner(uint256 id, uint256 winnerIdx)",
    "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)",
    "event Settled(uint256 indexed id, address indexed taker)",
    "event RFQPendingReveal(uint256 indexed id)",
]);
const seedKey = (label) => keccak256(stringToBytes(`tradi-demo-${label}`));
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOW = () => Math.floor(Date.now() / 1000);
async function createAndAcceptDirect(maker, taker, publicClient, sellToken, buyToken, sellAmount, minBuyAmount, takerBuyAmount, description) {
    console.log(`\n[settled] ${description}`);
    // Maker createIntent (1h deadline)
    console.log(`  [${maker.name}] createIntent…`);
    const sellEnc = await maker.handle.encryptInput(sellAmount, "uint256", ADDRESSES.privateOtc);
    const minBuyEnc = await maker.handle.encryptInput(minBuyAmount, "uint256", ADDRESSES.privateOtc);
    const deadline = BigInt(NOW() + 3600);
    const createTx = await maker.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "createIntent",
        args: [
            sellToken,
            buyToken,
            sellEnc.handle,
            sellEnc.handleProof,
            minBuyEnc.handle,
            minBuyEnc.handleProof,
            deadline,
            "0x0000000000000000000000000000000000000000",
        ],
        chain: maker.client.chain,
        account: maker.acc,
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
    let intentId = null;
    for (const log of createReceipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "IntentCreated") {
                intentId = decoded.args.id;
                break;
            }
        }
        catch { }
    }
    if (intentId === null) {
        console.log(`    ✗ failed to find IntentCreated event`);
        return null;
    }
    console.log(`    ✓ intent #${intentId} created`);
    // Taker acceptIntent (slightly above min so settlement is real, not encrypted no-op)
    console.log(`  [${taker.name}] acceptIntent #${intentId}…`);
    const buyEnc = await taker.handle.encryptInput(takerBuyAmount, "uint256", ADDRESSES.privateOtc);
    const acceptTx = await taker.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "acceptIntent",
        args: [intentId, buyEnc.handle, buyEnc.handleProof],
        chain: taker.client.chain,
        account: taker.acc,
    });
    const acceptReceipt = await publicClient.waitForTransactionReceipt({ hash: acceptTx });
    for (const log of acceptReceipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "Settled") {
                console.log(`    ✓ Settled — Frank trade audit trail at https://sepolia.arbiscan.io/tx/${acceptTx}`);
                return intentId;
            }
        }
        catch { }
    }
    console.log(`    ⚠ acceptIntent succeeded but no Settled event captured`);
    return intentId;
}
async function fullRFQVickrey(maker, bidders, publicClient, sellToken, buyToken, sellAmount, windowSec) {
    console.log(`\n[settled] RFQ Vickrey full flow — ${maker.name} sells ${sellAmount} for buyToken (${windowSec}s window)`);
    // Step 1: createRFQ
    console.log(`  [${maker.name}] createRFQ…`);
    const sellEnc = await maker.handle.encryptInput(sellAmount, "uint256", ADDRESSES.privateOtc);
    const deadline = BigInt(NOW() + windowSec);
    const createTx = await maker.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "createRFQ",
        args: [
            sellToken,
            buyToken,
            sellEnc.handle,
            sellEnc.handleProof,
            deadline,
        ],
        chain: maker.client.chain,
        account: maker.acc,
    });
    const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
    let rfqId = null;
    for (const log of createReceipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "IntentCreated") {
                rfqId = decoded.args.id;
                break;
            }
        }
        catch { }
    }
    if (rfqId === null) {
        console.log(`    ✗ failed to find IntentCreated event`);
        return null;
    }
    console.log(`    ✓ RFQ #${rfqId} created (deadline in ${windowSec}s)`);
    // Step 2: submit bids in order — winnerIdx will match bidder array index
    let winnerIdx = -1;
    for (let i = 0; i < bidders.length; i++) {
        const b = bidders[i];
        console.log(`  [${b.wallet.name}] bid ${b.label} (idx ${i})…`);
        const enc = await b.wallet.handle.encryptInput(b.amount, "uint256", ADDRESSES.privateOtc);
        const tx = await b.wallet.client.writeContract({
            address: ADDRESSES.privateOtc,
            abi: otcAbi,
            functionName: "submitBid",
            args: [rfqId, enc.handle, enc.handleProof],
            chain: b.wallet.client.chain,
            account: b.wallet.acc,
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
        if (b.willWin)
            winnerIdx = i;
    }
    if (winnerIdx < 0) {
        console.log(`    ✗ no bidder marked as winner — check seed config`);
        return rfqId;
    }
    // Step 3: wait for deadline to pass + small buffer
    const remainingMs = Number(deadline) * 1000 - Date.now() + 5000;
    console.log(`  ⏳ waiting ${Math.ceil(remainingMs / 1000)}s for bidding deadline + buffer…`);
    await sleep(remainingMs);
    // Step 4: anyone can call finalizeRFQ (we use maker)
    console.log(`  [${maker.name}] finalizeRFQ #${rfqId} (computes Vickrey 2nd-price)…`);
    const finalizeTx = await maker.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "finalizeRFQ",
        args: [rfqId],
        chain: maker.client.chain,
        account: maker.acc,
    });
    const finalizeReceipt = await publicClient.waitForTransactionReceipt({ hash: finalizeTx });
    let pendingReveal = false;
    for (const log of finalizeReceipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "RFQPendingReveal") {
                pendingReveal = true;
                break;
            }
        }
        catch { }
    }
    console.log(pendingReveal
        ? `    ✓ PendingReveal — Vickrey 2nd-price computed inside encrypted handles`
        : `    ⚠ finalize succeeded but no RFQPendingReveal event`);
    // Step 5: maker reveals winner (we know which idx because we set willWin)
    console.log(`  [${maker.name}] revealRFQWinner #${rfqId} winnerIdx=${winnerIdx}…`);
    const revealTx = await maker.client.writeContract({
        address: ADDRESSES.privateOtc,
        abi: otcAbi,
        functionName: "revealRFQWinner",
        args: [rfqId, BigInt(winnerIdx)],
        chain: maker.client.chain,
        account: maker.acc,
    });
    const revealReceipt = await publicClient.waitForTransactionReceipt({ hash: revealTx });
    for (const log of revealReceipt.logs) {
        try {
            const decoded = decodeEventLog({ abi: otcAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "Settled") {
                console.log(`    ✓ Settled — winner gets the goods, pays second-price`);
                console.log(`      audit trail: https://sepolia.arbiscan.io/tx/${revealTx}`);
                return rfqId;
            }
        }
        catch { }
    }
    console.log(`    ⚠ revealRFQWinner succeeded but no Settled event captured`);
    return rfqId;
}
async function main() {
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ??
        "https://sepolia-rollup.arbitrum.io/rpc";
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const labels = ["alice", "bob", "carol", "dave", "eve", "frank"];
    const wallets = {};
    for (const l of labels) {
        wallets[l] = await makeWallet(l, rpc);
    }
    console.log("[settled] PrivateOTC :", ADDRESSES.privateOtc);
    console.log("[settled] cUSDC      :", ADDRESSES.cusdc);
    console.log("[settled] cETH       :", ADDRESSES.ceth);
    const settled = [];
    // ─── 1. Direct OTC accepted: Alice → Frank ───
    const direct1 = await createAndAcceptDirect(wallets.alice, wallets.frank, publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("0.1", 18), parseUnits("300", 6), parseUnits("320", 6), // taker offers 320 (above 300 min) — settles real amounts
    "Direct OTC: Alice 0.1 cETH → ≥300 cUSDC, Frank accepts at 320");
    settled.push({
        kind: "Direct",
        id: direct1,
        summary: "Alice 0.1 cETH ↔ Frank 320 cUSDC — Filled",
    });
    // ─── 2. Direct OTC accepted: Bob → Eve ───
    const direct2 = await createAndAcceptDirect(wallets.bob, wallets.eve, publicClient, ADDRESSES.cusdc, ADDRESSES.ceth, parseUnits("1500", 6), parseUnits("0.4", 18), parseUnits("0.42", 18), // 0.42 above 0.4 min
    "Direct OTC: Bob 1500 cUSDC → ≥0.4 cETH, Eve accepts at 0.42");
    settled.push({
        kind: "Direct",
        id: direct2,
        summary: "Bob 1500 cUSDC ↔ Eve 0.42 cETH — Filled",
    });
    // ─── 3. Full RFQ Vickrey: Carol with 60s window, Frank wins, pays Alice's 2nd-price ───
    const rfq = await fullRFQVickrey(wallets.carol, [
        { wallet: wallets.dave, amount: parseUnits("1500", 6), label: "1500 cUSDC", willWin: false },
        { wallet: wallets.frank, amount: parseUnits("1620", 6), label: "1620 cUSDC (winner)", willWin: true },
        { wallet: wallets.alice, amount: parseUnits("1580", 6), label: "1580 cUSDC (2nd-price)", willWin: false },
    ], publicClient, ADDRESSES.ceth, ADDRESSES.cusdc, parseUnits("0.5", 18), 60);
    settled.push({
        kind: "RFQ Vickrey",
        id: rfq,
        summary: "Carol 0.5 cETH ↔ Frank 1580 cUSDC (paid Alice's 2nd-price) — Filled",
    });
    // ─── Summary ───
    console.log("\n[settled] ═════════════════════════════════════════════");
    console.log("[settled] ✓ Done — settled trades for Activity tab history");
    console.log("[settled] ═════════════════════════════════════════════\n");
    for (const s of settled) {
        console.log(`  #${s.id ?? "?"}  [${s.kind}] ${s.summary}`);
    }
    console.log("\nVisit /portfolio (per wallet) and Arbiscan to inspect the encrypted handles.");
    console.log("All amounts encrypted on-chain; only participants can decrypt via handle client allow ACL.\n");
}
main().catch((err) => {
    console.error("[settled] failed:", err);
    process.exit(1);
});
//# sourceMappingURL=seed-settled-examples.js.map