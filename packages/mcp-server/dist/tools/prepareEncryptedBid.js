import { z } from "zod";
import { encodeFunctionData } from "viem";
import { getEnv, getPublicClient, getHandleClient } from "../client.js";
import { privateOtcAbi } from "../abi.js";
const ArgsSchema = z.object({
    intentId: z.string().regex(/^\d+$/),
    bidAmount: z.string().regex(/^\d+$/),
});
export const prepareEncryptedBidTool = {
    name: "private_otc_prepare_encrypted_bid",
    description: "Encrypt a bid amount and return the encoded calldata for submitBid. The calldata can be passed to KeeperHub execute_contract_call for simulation and execution. Does NOT submit the transaction — use KeeperHub for that.",
    inputSchema: {
        type: "object",
        properties: {
            intentId: { type: "string", description: "RFQ intent ID to bid on (decimal string)" },
            bidAmount: { type: "string", description: "Bid amount in raw token units (will be encrypted)" },
        },
        required: ["intentId", "bidAmount"],
    },
    async handler(rawArgs) {
        const args = ArgsSchema.parse(rawArgs);
        const env = getEnv();
        const publicClient = getPublicClient();
        const handleClient = await getHandleClient();
        const id = BigInt(args.intentId);
        // Verify intent is an open RFQ
        const intent = (await publicClient.readContract({
            address: env.otc,
            abi: privateOtcAbi,
            functionName: "intents",
            args: [id],
        }));
        const [, , , , , deadline, status, mode] = intent;
        if (mode !== 1) {
            throw new Error(`Intent ${args.intentId} is not an RFQ (mode=${mode})`);
        }
        if (status !== 0) {
            throw new Error(`Intent ${args.intentId} is not Open (status=${status})`);
        }
        if (Date.now() / 1000 > Number(deadline)) {
            throw new Error(`Intent ${args.intentId} bidding deadline has passed`);
        }
        // Encrypt bid off-chain
        const { handle, handleProof } = await handleClient.encryptInput(BigInt(args.bidAmount), "uint256", env.otc);
        // Encode calldata for submitBid
        const calldata = encodeFunctionData({
            abi: privateOtcAbi,
            functionName: "submitBid",
            args: [id, handle, handleProof],
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        intentId: args.intentId,
                        bidAmount: args.bidAmount,
                        handle,
                        handleProof,
                        calldata,
                        target: env.otc,
                        function: "submitBid(uint256,bytes32,bytes)",
                        note: "Pass this calldata to KeeperHub execute_contract_call for simulation and execution.",
                    }, null, 2),
                },
            ],
        };
    },
};
//# sourceMappingURL=prepareEncryptedBid.js.map