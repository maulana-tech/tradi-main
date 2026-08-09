/**
 * Seed bids on RFQ #7 (whoever the maker is). Used when a user creates an
 * RFQ via the live frontend and wants competitive bidders without waiting.
 *
 * Run: PRIVATE_KEY=0x... pnpm --filter agents exec tsx src/seed/seed-bids-7.ts
 */
import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseUnits, parseAbi, keccak256, stringToBytes, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createViemHandleClient } from "../handle-client.js";
const ADDRESSES = {
    privateOtc: process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS,
};
if (!ADDRESSES.privateOtc)
    throw new Error("Set NEXT_PUBLIC_PRIVATE_OTC_ADDRESS");
const otcAbi = parseAbi([
    "function submitBid(uint256 id, bytes32 bidAmountHandle, bytes bidProof)",
]);
const seedKey = (label) => keccak256(stringToBytes(`tradi-demo-${label}`));
async function main() {
    const rfqId = 7n;
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ??
        "https://sepolia-rollup.arbitrum.io/rpc";
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const bidPlan = [
        { name: "Alice", key: seedKey("alice"), amount: parseUnits("5800", 6) },
        { name: "Bob", key: seedKey("bob"), amount: parseUnits("6500", 6) },
        { name: "Carol", key: seedKey("carol"), amount: parseUnits("6200", 6) },
        { name: "Dave", key: seedKey("dave"), amount: parseUnits("5500", 6) },
        { name: "Eve", key: seedKey("eve"), amount: parseUnits("6700", 6) }, // ← winner
        { name: "Frank", key: seedKey("frank"), amount: parseUnits("6100", 6) },
    ];
    for (const plan of bidPlan) {
        const acc = privateKeyToAccount(plan.key);
        console.log(`\n[seed-bids-7] ${plan.name} bids ${plan.amount} on RFQ #${rfqId}…`);
        const wallet = createWalletClient({
            account: acc,
            chain: arbitrumSepolia,
            transport: http(rpc),
        });
        const handle = await createViemHandleClient(wallet);
        const enc = await handle.encryptInput(plan.amount, "uint256", ADDRESSES.privateOtc);
        try {
            const tx = await wallet.writeContract({
                address: ADDRESSES.privateOtc,
                abi: otcAbi,
                functionName: "submitBid",
                args: [rfqId, enc.handle, enc.handleProof],
                chain: wallet.chain,
                account: acc,
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            console.log(`  ✓ tx ${tx}`);
        }
        catch (err) {
            console.error(`  ✗ submitBid failed:`, err instanceof Error ? err.message.split("\n")[0] : err);
        }
    }
    console.log(`\n[seed-bids-7] ✓ done. View: https://private-otc.vercel.app/rfq/${rfqId}`);
}
main().catch((err) => {
    console.error("[seed-bids-7] failed:", err);
    process.exit(1);
});
//# sourceMappingURL=seed-bids-7.js.map