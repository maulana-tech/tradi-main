import { z } from "zod";

const ArgsSchema = z.object({
  base: z.string().min(1),
  quote: z.string().min(1),
});

const PRICE_TABLE: Record<string, number> = {
  "cETH/cUSDC": 3500,
  "cUSDC/cETH": 1 / 3500,
  "ETH/USDC": 3500,
  "USDC/ETH": 1 / 3500,
};

export const getPriceReferenceTool = {
  name: "private_otc_get_price_reference",
  description:
    "Get the reference price for a token pair. Returns a fair-value estimate in quote units per base unit. Use this to decide bid amounts for RFQ auctions.",
  inputSchema: {
    type: "object",
    properties: {
      base: { type: "string", description: "Base token symbol or address (e.g. cETH, ETH)" },
      quote: { type: "string", description: "Quote token symbol or address (e.g. cUSDC, USDC)" },
    },
    required: ["base", "quote"],
  },
  async handler(rawArgs: Record<string, unknown>) {
    const args = ArgsSchema.parse(rawArgs);

    const pair = `${args.base}/${args.quote}`;
    const reversePair = `${args.quote}/${args.base}`;

    let price = PRICE_TABLE[pair];
    let direction: "direct" | "reverse" = "direct";

    if (price === undefined && PRICE_TABLE[reversePair] !== undefined) {
      price = 1 / PRICE_TABLE[reversePair];
      direction = "reverse";
    }

    if (price === undefined) {
      price = 1;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              pair,
              price,
              direction,
              source: "static-testnet",
              note:
                "This is a static testnet reference price. Production should use Uniswap TWAP or Chainlink.",
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
