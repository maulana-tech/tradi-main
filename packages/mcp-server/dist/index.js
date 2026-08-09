/**
 * PrivateOTC MCP Server.
 *
 * Exposes the OTC desk as MCP tools so AI agents (Hermes, Claude, Cursor)
 * can trade on user's behalf — privately.
 *
 * Read/Prepare tools (for Hermes + KeeperHub flow):
 *   - private_otc_browse_intents      — list open intents
 *   - private_otc_read_rfq_state      — read full RFQ state + bid count
 *   - private_otc_get_price_reference — get fair-value price for a pair
 *   - private_otc_prepare_encrypted_bid — encrypt bid + return calldata
 *   - private_otc_explain_execution   — explain KeeperHub execution outcome
 *
 * Write tools (direct — use only when KeeperHub is unavailable):
 *   - private_otc_create_intent       — create Direct OTC intent
 *   - private_otc_decrypt_balance     — decrypt confidential balance
 */
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createIntentTool } from "./tools/createIntent.js";
import { browseIntentsTool } from "./tools/browseIntents.js";
import { decryptBalanceTool } from "./tools/decryptBalance.js";
import { readRfqStateTool } from "./tools/readRfqState.js";
import { getPriceReferenceTool } from "./tools/getPriceReference.js";
import { prepareEncryptedBidTool } from "./tools/prepareEncryptedBid.js";
import { explainExecutionTool } from "./tools/explainExecution.js";
const server = new Server({
    name: "private-otc",
    version: "0.2.0",
}, {
    capabilities: {
        tools: {},
        resources: {},
        prompts: {},
    },
});
const tools = [
    browseIntentsTool,
    readRfqStateTool,
    getPriceReferenceTool,
    prepareEncryptedBidTool,
    explainExecutionTool,
    createIntentTool,
    decryptBalanceTool,
];
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
    })),
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool)
        throw new Error(`Unknown tool: ${request.params.name}`);
    return await tool.handler(request.params.arguments ?? {});
});
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp] private-otc server started");
//# sourceMappingURL=index.js.map