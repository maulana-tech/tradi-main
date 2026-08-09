# Hermes Setup for Tradi

Hermes is the RFQ decision maker. It reads state via the Tradi MCP and executes via KeeperHub MCP.

## Prerequisites

- Hermes Agent installed
- KeeperHub organization API key (`kh_` prefix) or OAuth
- Wallet integration configured on KeeperHub
- Contract and cTokens deployed on Arbitrum Sepolia
- Bidder wallet has test tokens and has authorized `PrivateOTC` as operator
- Workspace deps installed: `pnpm install`

## Quick Start

### 1. Set up secrets

Create `~/.hermes/.env`:

```env
KEEPERHUB_API_KEY=kh_your_key_here
AGENT_PRIVATE_KEY=0x...
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
PRIVATE_OTC_ADDRESS=0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4
```

**Important:** Use a read-only key for `AGENT_PRIVATE_KEY` (no funds). This key is only used by the Tradi MCP for reading on-chain state. Do NOT use the KeeperHub wallet key or user wallet key.

### 2. Build the MCP server

```bash
pnpm --filter mcp-server build
```

### 3. Verify tools

Start Hermes and verify the tools are available:

```bash
hermes chat --config hermes/config.yaml
```

Prompt:
```
List all available MCP tools. Do not execute any writes.
```

### 4. Test read flow

```
Browse open RFQ intents on PrivateOTC.
```

## Architecture

```
Hermes (decision maker)
├── Tradi MCP (stdio) — read state, prepare calldata
│   ├── private_otc_browse_intents
│   ├── private_otc_read_rfq_state
│   ├── private_otc_get_price_reference
│   ├── private_otc_prepare_encrypted_bid
│   └── private_otc_explain_execution
└── KeeperHub MCP (remote) — simulate + execute
    ├── execute_contract_call
    └── get_direct_execution_status
```

Hermes does NOT hold execution private keys. KeeperHub handles signing and broadcasting.

## Policy

See `policy.md` for the full Hermes RFQ decision policy. Key points:

- Always read state before deciding
- Always simulate before executing
- Terminal errors (revert, operator not active) = no retry
- Store full audit evidence from KeeperHub

## Troubleshooting

| Symptom | Check |
|---|---|
| `401` | API key wrong, missing, or not organization key |
| Wallet not available | Check `get_wallet_integration` and active organization |
| Simulation revert | Check ABI, RFQ state, balance, allowance, operator permission |
| No tx hash | Normal for simulation; tx hash only after broadcast |
| `sponsored: false` | Check network, sender, public routing, gas credit |
| Hermes doesn't see tools | Check whitelist, restart/reload MCP, check logs |
| Settlement `not operator` | Both holders must call `setOperator(PrivateOTC, until)` |

## References

- [Hermes MCP integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [Use MCP with Hermes](https://hermes-agent.nousresearch.com/docs/guides/use-mcp-with-hermes)
- [KeeperHub MCP Server](https://docs.keeperhub.com/ai-tools/mcp-server)
- [KeeperHub Direct Execution API](https://docs.keeperhub.com/api/direct-execution)
- [KeeperHub Gas Management](https://docs.keeperhub.com/wallet-management/gas)
