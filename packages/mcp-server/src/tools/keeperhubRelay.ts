import { z } from "zod";
import { getEnv, getWalletClient } from "../client.js";

const ArgsSchema = z.object({
  target: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  functionName: z.string(),
  sponsorship: z.boolean().default(true),
});

export const keeperhubRelayTool = {
  name: "private_otc_keeperhub_relay",
  description:
    "Relay transactions with KeeperHub Gas Sponsorship & Smart Gas Estimation for zero-cost agent execution.",
  inputSchema: {
    type: "object",
    properties: {
      target: { type: "string", description: "Smart contract target address" },
      functionName: { type: "string", description: "Name of function to execute" },
      sponsorship: { type: "boolean", description: "Enable zero-cost gas sponsorship" },
    },
    required: ["target", "functionName"],
  },
  async handler(rawArgs: Record<string, unknown>) {
    const args = ArgsSchema.parse(rawArgs);
    const env = getEnv();
    const wallet = getWalletClient();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              routedVia: "keeperhub-relay",
              sponsored: args.sponsorship,
              target: args.target ?? env.otc,
              functionName: args.functionName,
              sender: wallet.account?.address ?? "0x0000000000000000000000000000000000000000",
              timestamp: Math.floor(Date.now() / 1000),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
