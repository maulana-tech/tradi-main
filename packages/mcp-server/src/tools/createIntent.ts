import { z } from "zod";
import { decodeEventLog } from "viem";
import { getEnv, getWalletClient, getPublicClient, getHandleClient } from "../client.js";
import { privateOtcAbi } from "../abi.js";

const ArgsSchema = z.object({
  sellToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  buyToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  sellAmount: z.string(), // string to handle bigint over JSON
  minBuyAmount: z.string(),
  deadlineSeconds: z.number().positive(),
  allowedTaker: z.string().optional(),
});

export const createIntentTool = {
  name: "private_otc_create_intent",
  description:
    "Create a new Direct OTC intent. Encrypts sellAmount and minBuyAmount via Nox, submits to PrivateOTC contract on Arbitrum Sepolia. Returns intentId + txHash.",
  inputSchema: {
    type: "object",
    properties: {
      sellToken: { type: "string", description: "cToken address to sell" },
      buyToken: { type: "string", description: "cToken address to buy" },
      sellAmount: { type: "string", description: "Sell amount in raw units (will be encrypted)" },
      minBuyAmount: { type: "string", description: "Min acceptable buy in raw units (encrypted)" },
      deadlineSeconds: { type: "number", description: "Seconds until expiry" },
      allowedTaker: { type: "string", description: "Optional: lock to specific taker. Empty = open." },
    },
    required: ["sellToken", "buyToken", "sellAmount", "minBuyAmount", "deadlineSeconds"],
  },
  async handler(rawArgs: Record<string, unknown>) {
    const args = ArgsSchema.parse(rawArgs);
    const env = getEnv();
    const wallet = getWalletClient();
    const publicClient = getPublicClient();
    const handleClient = await getHandleClient();

    // Encrypt off-chain
    const sell = await handleClient.encryptInput(
      BigInt(args.sellAmount),
      "uint256",
      env.otc
    );
    const minBuy = await handleClient.encryptInput(
      BigInt(args.minBuyAmount),
      "uint256",
      env.otc
    );

    const deadline =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(args.deadlineSeconds);

    const txHash = await wallet.writeContract({
      address: env.otc,
      abi: privateOtcAbi,
      functionName: "createIntent",
      args: [
        args.sellToken as `0x${string}`,
        args.buyToken as `0x${string}`,
        sell.handle as `0x${string}`,
        sell.handleProof as `0x${string}`,
        minBuy.handle as `0x${string}`,
        minBuy.handleProof as `0x${string}`,
        deadline,
        (args.allowedTaker ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      ],
      chain: wallet.chain,
      account: wallet.account!,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let intentId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: privateOtcAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "IntentCreated") {
          intentId = decoded.args.id;
          break;
        }
      } catch {
        // not our event
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              intentId: intentId?.toString() ?? null,
              txHash,
              etherscan: `https://sepolia.arbiscan.io/tx/${txHash}`,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
