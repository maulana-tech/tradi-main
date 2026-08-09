# MCP Server Package — PrivateOTC

## What is this?

An MCP server that exposes PrivateOTC as AI-native trading tools. AI agents (Claude, Cursor) can create an intent, submit a bid, or decrypt a balance through a single prompt.

Matches the hackathon brief: MCP is listed as an accepted vibe-coding tool.

## Stack

- `@modelcontextprotocol/sdk` ^1.0
- viem v2 (RPC)
- `@iexec-nox/handle` (encryption — wrapped via `handle-client.ts`)
- zod (validation)
- ESM only

## Tools Exposed

| Tool | Purpose | Status |
|---|---|---|
| `private_otc_browse_intents` | List open intents (metadata only) | ✅ |
| `private_otc_read_rfq_state` | Read full RFQ state + bid count | ✅ |
| `private_otc_get_price_reference` | Get fair-value price for a pair | ✅ |
| `private_otc_prepare_encrypted_bid` | Encrypt bid, return calldata | ✅ |
| `private_otc_explain_execution` | Explain KeeperHub execution outcome | ✅ |
| `private_otc_create_intent` | Create Direct OTC intent (write) | ✅ |
| `private_otc_decrypt_balance` | Decrypt confidential balance | ✅ |

**Read/Prepare flow** (for Hermes + KeeperHub):
1. `browse_intents` → find RFQ
2. `read_rfq_state` → check status, bid count, deadline
3. `get_price_reference` → get fair value
4. `prepare_encrypted_bid` → encrypt + encode calldata
5. Pass calldata to KeeperHub `execute_contract_call`
6. `explain_execution` → interpret result

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
