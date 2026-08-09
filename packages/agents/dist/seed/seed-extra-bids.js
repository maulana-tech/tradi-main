/**
 * Extra bidders — adds 4 more deterministic wallets (Dave, Eve, Frank, Grace)
 * funded from the deployer + bidding on the live RFQs (#11 and #12).
 *
 * Effect: each RFQ goes from 3 bids → 7 bids, making Vickrey selection
 * non-trivial and the "active auction" feel real for the demo.
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/seed-extra-bids.ts
 */
import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseUnits, parseEther, parseAbi, keccak256, stringToBytes, formatEther, } from "viem";
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
    "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
    "function intents(uint256) view returns (address maker, address sellToken, address buyToken, bytes32 sellAmount, bytes32 minBuyAmount, uint64 deadline, uint8 status, uint8 mode, address allowedTaker, bytes32 priceToPay)",
]);
const seedKey = (label) => keccak256(stringToBytes(`tradi-demo-${label}`));
const NEW_BIDDERS = ["dave", "eve", "frank", "grace"];
async function main() {
    const adminKey = process.env.PRIVATE_KEY;
    if (!adminKey || !/^0x[a-fA-F0-9]{64}$/.test(adminKey)) {
        throw new Error("PRIVATE_KEY required");
    }
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ??
        "https://sepolia-rollup.arbitrum.io/rpc";
    const adminAccount = privateKeyToAccount(adminKey);
    const adminWallet = createWalletClient({
        account: adminAccount,
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    console.log("[seed-extra-bids] funder:", adminAccount.address);
    /* ──── Step 1: fund 4 new wallets + mint cUSDC + setOperator ──── */
    for (const label of NEW_BIDDERS) {
        const acc = privateKeyToAccount(seedKey(label));
        console.log(`\n[seed-extra-bids] ─── ${label} (${acc.address}) ───`);
        const bal = await publicClient.getBalance({ address: acc.address });
        console.log(`  ETH balance: ${formatEther(bal)}`);
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
        const wallet = createWalletClient({
            account: acc,
            chain: arbitrumSepolia,
            transport: http(rpc),
        });
        const handle = await createViemHandleClient(wallet);
        // Mint cUSDC for bid funding (50k each, plenty).
        console.log(`  mint 50k cUSDC…`);
        const mintEnc = await handle.encryptInput(parseUnits("50000", 6), "uint256", ADDRESSES.cusdc);
        const mintTx = await wallet.writeContract({
            address: ADDRESSES.cusdc,
            abi: cTokenAbi,
            functionName: "faucet",
            args: [mintEnc.handle, mintEnc.handleProof],
            chain: wallet.chain,
            account: acc,
        });
        await publicClient.waitForTransactionReceipt({ hash: mintTx });
        // setOperator on cUSDC (bidders pay in cUSDC).
        const until = Math.floor(Date.now() / 1000) + 86400;
        const isOp = (await publicClient.readContract({
            address: ADDRESSES.cusdc,
            abi: cTokenAbi,
            functionName: "isOperator",
            args: [acc.address, ADDRESSES.privateOtc],
        }));
        if (!isOp) {
            console.log(`  setOperator(PrivateOTC, +24h)…`);
            const opTx = await wallet.writeContract({
                address: ADDRESSES.cusdc,
                abi: cTokenAbi,
                functionName: "setOperator",
                args: [ADDRESSES.privateOtc, until],
                chain: wallet.chain,
                account: acc,
            });
            await publicClient.waitForTransactionReceipt({ hash: opTx });
        }
    }
    /* ──── Step 2: stagger bids across both live RFQs ─────────────── */
    // RFQ #12 already has Alice 5800 / Bob 6500 / Carol 6200.
    // RFQ #11 already has Deployer 3000 / Alice 3300 / Bob 3500.
    // Add 4 more to each — varied amounts so Vickrey winner stays interesting.
    const bidPlan = [
        // RFQ #12 (deployer-owned, 24h, ceth/cusdc) — Bob still leads at 6500
        { rfqId: 6n, bidder: "dave", amount: parseUnits("5500", 6) },
        { rfqId: 6n, bidder: "eve", amount: parseUnits("6700", 6) }, // ← Eve becomes new winner
        { rfqId: 6n, bidder: "frank", amount: parseUnits("6100", 6) },
        { rfqId: 6n, bidder: "grace", amount: parseUnits("5900", 6) },
        // RFQ #5 (Carol-owned, 4h)
        { rfqId: 5n, bidder: "dave", amount: parseUnits("3100", 6) },
        { rfqId: 5n, bidder: "eve", amount: parseUnits("3700", 6) }, // ← Eve takes the lead here too
        { rfqId: 5n, bidder: "frank", amount: parseUnits("3400", 6) },
        { rfqId: 5n, bidder: "grace", amount: parseUnits("3200", 6) },
    ];
    for (const plan of bidPlan) {
        const acc = privateKeyToAccount(seedKey(plan.bidder));
        const wallet = createWalletClient({
            account: acc,
            chain: arbitrumSepolia,
            transport: http(rpc),
        });
        const handle = await createViemHandleClient(wallet);
        // Verify RFQ is bid-eligible
        const intent = (await publicClient.readContract({
            address: ADDRESSES.privateOtc,
            abi: otcAbi,
            functionName: "intents",
            args: [plan.rfqId],
        }));
        if (intent[6] !== 0 || intent[7] !== 1) {
            console.log(`[seed-extra-bids] RFQ #${plan.rfqId} not biddable (status=${intent[6]} mode=${intent[7]}), skipping ${plan.bidder}`);
            continue;
        }
        if (intent[5] < BigInt(Math.floor(Date.now() / 1000))) {
            console.log(`[seed-extra-bids] RFQ #${plan.rfqId} expired, skipping ${plan.bidder}`);
            continue;
        }
        console.log(`\n[seed-extra-bids] ${plan.bidder} bids ${plan.amount} on RFQ #${plan.rfqId}…`);
        const enc = await handle.encryptInput(plan.amount, "uint256", ADDRESSES.privateOtc);
        try {
            const tx = await wallet.writeContract({
                address: ADDRESSES.privateOtc,
                abi: otcAbi,
                functionName: "submitBid",
                args: [
                    plan.rfqId,
                    enc.handle,
                    enc.handleProof,
                ],
                chain: wallet.chain,
                account: acc,
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            console.log(`  ✓ tx ${tx}`);
        }
        catch (err) {
            console.error(`  ✗ submitBid failed:`, err instanceof Error ? err.message : err);
        }
    }
    console.log(`\n[seed-extra-bids] ✓ done. Active RFQs:\n  https://private-otc.vercel.app/rfq/5 (Carol, 4h, 7 bids)\n  https://private-otc.vercel.app/rfq/6 (you, 24h, 7 bids — Eve leads at 6700)\n`);
}
main().catch((err) => {
    console.error("[seed-extra-bids] failed:", err);
    process.exit(1);
});
//# sourceMappingURL=seed-extra-bids.js.map