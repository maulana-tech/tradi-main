import { z } from "zod";
import { getPublicClient, getHandleClient } from "../client.js";
import { erc7984Abi } from "../abi.js";
const ArgsSchema = z.object({
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
export const decryptBalanceTool = {
    name: "private_otc_decrypt_balance",
    description: "Decrypt the agent's confidential balance for a given ERC-7984 cToken. Returns plaintext as decimal string. Caller must be on the handle's ACL (granted via setOperator or direct mint).",
    inputSchema: {
        type: "object",
        properties: {
            tokenAddress: {
                type: "string",
                description: "Address of the ERC-7984 cToken (e.g. cUSDC, cETH)",
            },
        },
        required: ["tokenAddress"],
    },
    async handler(rawArgs) {
        const args = ArgsSchema.parse(rawArgs);
        const publicClient = getPublicClient();
        const handleClient = await getHandleClient();
        // Get handle from cToken
        const wallet = (await import("../client.js")).getWalletClient();
        const handle = (await publicClient.readContract({
            address: args.tokenAddress,
            abi: erc7984Abi,
            functionName: "confidentialBalanceOf",
            args: [wallet.account.address],
        }));
        // Decrypt off-chain
        const result = await handleClient.decrypt(handle);
        const value = result.value;
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        tokenAddress: args.tokenAddress,
                        account: wallet.account.address,
                        handle,
                        balance: value.toString(),
                    }, null, 2),
                },
            ],
        };
    },
};
//# sourceMappingURL=decryptBalance.js.map