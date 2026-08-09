import { z } from "zod";
import { getEnv, getPublicClient } from "../client.js";
import { privateOtcAbi } from "../abi.js";

const ArgsSchema = z.object({
  intentId: z.string().regex(/^\d+$/),
});

const STATUS = ["Open", "Filled", "Cancelled", "Expired", "PendingReveal"] as const;
const MODE = ["Direct", "RFQ"] as const;

export const readRfqStateTool = {
  name: "private_otc_read_rfq_state",
  description:
    "Read full RFQ state for a given intent: maker, tokens, mode, status, deadline, bid count. Encrypted amounts are NOT decrypted. Use this before making a bid/finalize decision.",
  inputSchema: {
    type: "object",
    properties: {
      intentId: { type: "string", description: "The intent ID to read (decimal string)" },
    },
    required: ["intentId"],
  },
  async handler(rawArgs: Record<string, unknown>) {
    const args = ArgsSchema.parse(rawArgs);
    const env = getEnv();
    const publicClient = getPublicClient();
    const id = BigInt(args.intentId);

    const intent = (await publicClient.readContract({
      address: env.otc,
      abi: privateOtcAbi,
      functionName: "intents",
      args: [id],
    })) as readonly [
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      bigint,
      number,
      number,
      `0x${string}`,
    ];

    const [maker, sellToken, buyToken, , , deadline, status, mode, allowedTaker] = intent;

    let bidCount = 0;
    if (mode === 1) {
      // RFQ mode — count bids by reading until revert
      for (let i = 0; i < 10; i++) {
        try {
          await publicClient.readContract({
            address: env.otc,
            abi: privateOtcAbi,
            functionName: "bids",
            args: [id, BigInt(i)],
          });
          bidCount++;
        } catch {
          break;
        }
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const deadlineNum = Number(deadline);
    const isExpired = now > deadlineNum;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              intentId: args.intentId,
              maker,
              sellToken,
              buyToken,
              mode: MODE[mode] ?? "Unknown",
              status: STATUS[status] ?? "Unknown",
              deadline: deadlineNum,
              deadlineHuman: new Date(deadlineNum * 1000).toISOString(),
              isExpired,
              allowedTaker,
              bidCount: mode === 1 ? bidCount : null,
              canBid: mode === 1 && status === 0 && !isExpired && bidCount < 10,
              canFinalize: mode === 1 && status === 0 && isExpired && bidCount >= 2,
              canReveal: mode === 1 && status === 4,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
