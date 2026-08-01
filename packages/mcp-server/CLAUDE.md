# MCP Server Package — PrivateOTC

## What is this?

An MCP server that exposes PrivateOTC as AI-native trading tools. AI agents (Claude, Cursor) can create an intent, submit a bid, or decrypt a balance through a single prompt.

Matches the hackathon brief: MCP is listed as an accepted vibe-coding tool.

## Stack

- `@modelcontextprotocol/sdk` ^1.0
- viem v2 (RPC)
- `@iexec-nox/handle` (encryption)
- zod (validation)
- ESM only

## Tools Exposed

| Tool | Status |
|---|---|
| `private_otc_create_intent` | Skeleton ✅ |
| `private_otc_browse_intents` | Skeleton ✅ |
| `private_otc_decrypt_balance` | Skeleton ✅ |
| `private_otc_submit_bid` | TODO |
| `private_otc_audit_trade` | TODO |
| `private_otc_analyze_market` | TODO |

## Resources Exposed

| URI | Status |
|---|---|
| `privateotc://intents/open` | TODO |
| `privateotc://rfq/active` | TODO |
| `privateotc://history/mine` | TODO |
| `privateotc://config/strategy` | TODO |

## Prompts Exposed

| Prompt | Status |
|---|---|
| `trade-suggest` | TODO |
| `risk-check` | TODO |

## Run

```bash
pnpm dev                       # tsx watch
pnpm inspect                   # MCP Inspector for testing
pnpm build && pnpm start       # production
```

## Configure as Claude Code MCP server

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "private-otc": {
      "command": "node",
      "args": ["F:/Hackathons/Hackathon Iexec/private-otc/packages/mcp-server/dist/index.js"],
      "env": {
        "AGENT_PRIVATE_KEY": "0x...",
        "ARBITRUM_SEPOLIA_RPC_URL": "https://...",
        "NEXT_PUBLIC_PRIVATE_OTC_ADDRESS": "0x..."
      }
    }
  }
}
```

## Conventions

- Tools defined as object literal with `name`, `description`, `inputSchema`, `handler`
- All inputSchemas use JSON Schema (not zod directly — MCP requires JSON Schema format)
- Validate inside handler with zod from inputSchema-equivalent shape
- Return `{ content: [{ type: "text", text: ... }] }` per MCP spec
- Errors throw — MCP transport catches and returns to client
