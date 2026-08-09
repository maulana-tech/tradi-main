/**
 * Pre-seed balance check — derives demo wallet addresses and reports
 * ETH balance of each on Arbitrum Sepolia. Used to plan funding budget
 * before running seed-30d-demo.
 */
import "dotenv/config";
import { createPublicClient, http, keccak256, stringToBytes, formatEther, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
const seedKey = (label) => keccak256(stringToBytes(`tradi-demo-${label}`));
async function main() {
    const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ??
        "https://sepolia-rollup.arbitrum.io/rpc";
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpc),
    });
    const labels = ["alice", "bob", "carol", "dave", "eve", "frank"];
    console.log("Demo wallet balances on Arbitrum Sepolia:\n");
    let needsFunding = 0;
    for (const label of labels) {
        const acc = privateKeyToAccount(seedKey(label));
        const bal = await publicClient.getBalance({ address: acc.address });
        const ethBal = formatEther(bal);
        const needs = bal < 3000000000000000n; // < 0.003 ETH
        if (needs)
            needsFunding++;
        console.log(`  ${label.padEnd(8)} ${acc.address}  ${ethBal.padStart(20)} ETH${needs ? "  ⚠️ low" : ""}`);
    }
    // Also check deployer
    const deployerKey = process.env.PRIVATE_KEY;
    if (deployerKey) {
        const dep = privateKeyToAccount(deployerKey);
        const bal = await publicClient.getBalance({ address: dep.address });
        console.log(`\n  deployer ${dep.address}  ${formatEther(bal).padStart(20)} ETH`);
    }
    console.log(`\n${needsFunding} of ${labels.length} demo wallets need funding (~0.005 ETH each = ${(needsFunding * 0.005).toFixed(3)} ETH total)`);
}
main().catch((err) => {
    console.error("[check-balances] failed:", err);
    process.exit(1);
});
//# sourceMappingURL=check-balances.js.map