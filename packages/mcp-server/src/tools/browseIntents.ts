import { z } from "zod";
import { getEnv, getPublicClient } from "../client.js";
import { privateOtcAbi } from "../abi.js";

const ArgsSchema = z.object({
  sellToken: z.string().optional(),
  buyToken: z.string().optional(),
  mode: z.enum(["direct", "rfq", "all"]).optional(),
  limit: z.number().min(1).max(50).optional(),
});

const STATUS = ["Open", "Filled", "Cancelled", "Expired"] as const;
const MODE = ["Direct", "RFQ"] as const;

export const browseIntentsTool = {
  name: "private_otc_browse_intents",
  description:
    "List currently open OTC intents on PrivateOTC. Returns metadata only; encrypted amounts are NOT decrypted (caller doesn't have ACL).",
  inputSchema: {
    type: "object",
    properties: {
      sellToken: { type: "string", description: "Filter by sell cToken" },
      buyToken: { type: "string", description: "Filter by buy cToken" },
      mode: { type: "string", enum: ["direct", "rfq", "all"], description: "Filter by mode" },
      limit: { type: "number", description: "Max intents to return (default 20)" },
    },
  },
  async handler(rawArgs: Record<string, unknown>) {
    const args = ArgsSchema.parse(rawArgs);
    const env = getEnv();
    const publicClient = getPublicClient();
    const limit = args.limit ?? 20;

    const next = (await publicClient.readContract({
      address: env.otc,
      abi: privateOtcAbi,
      functionName: "nextIntentId",
    })) as bigint;

    const total = Number(next);
    const start = Math.max(0, total - limit);

    const rows: Array<{
      id: string;
      maker: string;
      sellToken: string;
      buyToken: string;
      mode: string;
      status: string;
      deadline: number;
    }> = [];

    for (let i = start; i < total; i++) {
      try {
        const r = (await publicClient.readContract({
          address: env.otc,
          abi: privateOtcAbi,
          functionName: "intents",
          args: [BigInt(i)],
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

        // Filters
        if (args.sellToken && r[1].toLowerCase() !== args.sellToken.toLowerCase()) continue;
        if (args.buyToken && r[2].toLowerCase() !== args.buyToken.toLowerCase()) continue;
        if (args.mode === "direct" && r[7] !== 0) continue;
        if (args.mode === "rfq" && r[7] !== 1) continue;
        if (r[6] !== 0) continue; // only Open

        rows.push({
          id: i.toString(),
          maker: r[0],
          sellToken: r[1],
          buyToken: r[2],
          mode: MODE[r[7]] ?? "Unknown",
          status: STATUS[r[6]] ?? "Unknown",
          deadline: Number(r[5]),
        });
      } catch {
        continue;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows.reverse(), null, 2),
        },
      ],
    };
  },
};
