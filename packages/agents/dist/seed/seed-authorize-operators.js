/**
 * One-shot fix: every seed wallet (alice/bob/carol/dave/eve/frank + admin)
 * calls setOperator(PrivateOTC, +60d) on BOTH cTokens. Without this any
 * existing seed-created intent / seed-submitted bid that gets accepted
 * or revealed reverts with "TradiNoxCToken: not operator".
 *
 * Run:
 *   PRIVATE_KEY=0x... pnpm --filter agents tsx src/seed/seed-authorize-operators.ts
 *
 * Idempotent — checks isOperator first, skips authorized wallets.
 */
import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseAbi, keccak256, stringToBytes, formatEther, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
const ADDRESSES = {
    privateOtc: process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS,
    cusdc: process.env.NEXT_PUBLIC_CUSDC_ADDRESS,
    ceth: process.env.NEXT_PUBLIC_CETH_ADDRESS,
};
if (!ADDRESSES.privateOtc || !ADDRESSES.cusdc || !ADDRESSES.ceth) {
    throw new Error("Set NEXT_PUBLIC_PRIVATE_OTC_ADDRESS / CUSDC_ADDRESS / CETH_ADDRESS");
}
const cTokenAbi = parseAbi([
    "function setOperator(address operator, uint48 until)",
    "function isOperator(address holder, address spender) view returns (bool)",
]);
const seedKey = (label) => keccak256(stringToBytes(`tradi-demo-${label}`));
const SIXTY_DAYS = 60 * 24 * 60 * 60;
async function main() {
    const adminKey = process.env.PRIVATE_KEY;
    if (!adminKey || !/^0x[a-fA-F0-9]{64}$/.test(adminKey)) {
        throw new Error("PRIVATE_KEY env required (deployer wallet — used for admin entry)");
    }
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ??
        "https://sepolia-rollup.arbitrum.io/rpc";
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const wallets = [
        { name: "admin", key: adminKey },
        { name: "alice", key: seedKey("alice") },
        { name: "bob", key: seedKey("bob") },
        { name: "carol", key: seedKey("carol") },
        { name: "dave", key: seedKey("dave") },
        { name: "eve", key: seedKey("eve") },
        { name: "frank", key: seedKey("frank") },
    ];
    const tokens = [
        { symbol: "cUSDC", address: ADDRESSES.cusdc },
        { symbol: "cETH", address: ADDRESSES.ceth },
    ];
    const expiry = Math.floor(Date.now() / 1000) + SIXTY_DAYS;
    for (const w of wallets) {
        const account = privateKeyToAccount(w.key);
        const walletClient = createWalletClient({
            account,
            chain: arbitrumSepolia,
            transport: http(rpc),
        });
        const balance = await publicClient.getBalance({ address: account.address });
        if (balance < 100000000000000n) {
            // < 0.0001 ETH → can't pay gas. Skip with notice.
            console.log(`[auth] ${w.name} (${account.address}) low ETH ${formatEther(balance)} — skip`);
            continue;
        }
        for (const t of tokens) {
            try {
                const already = (await publicClient.readContract({
                    address: t.address,
                    abi: cTokenAbi,
                    functionName: "isOperator",
                    args: [account.address, ADDRESSES.privateOtc],
                }));
                if (already) {
                    console.log(`[auth] ${w.name} × ${t.symbol} already authorized — skip`);
                    continue;
                }
                const hash = await walletClient.writeContract({
                    address: t.address,
                    abi: cTokenAbi,
                    functionName: "setOperator",
                    args: [ADDRESSES.privateOtc, expiry],
                });
                console.log(`[auth] ${w.name} × ${t.symbol} setOperator → ${hash}`);
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status !== "success") {
                    console.error(`[auth] ${w.name} × ${t.symbol} REVERTED`);
                }
                else {
                    console.log(`[auth] ${w.name} × ${t.symbol} ✓ block ${receipt.blockNumber}`);
                }
            }
            catch (err) {
                console.error(`[auth] ${w.name} × ${t.symbol} failed:`, err instanceof Error ? err.message.split("\n")[0] : err);
            }
        }
    }
    console.log("\n[auth] Done. Existing seed intents / bids should now be settle-able.");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=seed-authorize-operators.js.map