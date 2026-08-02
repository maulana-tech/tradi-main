/**
 * PrivateOTC MCP Server.
 *
 * Exposes the OTC desk as MCP tools so AI agents (Claude, Cursor,
 * etc.) can trade on user's behalf — privately.
 *
 * Tools:
 *   - private_otc_create_intent
 *   - private_otc_browse_intents
 *   - private_otc_submit_bid
 *   - private_otc_decrypt_balance
 *   - private_otc_audit_trade
 *   - private_otc_analyze_market
 *
 * Resources:
 *   - privateotc://intents/open
 *   - privateotc://rfq/active
 *   - privateotc://history/mine
 *
 * Prompts:
 *   - trade-suggest
 *   - risk-check
 */

import "dotenv/config";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createIntentTool } from "./tools/createIntent.js";
import { browseIntentsTool } from "./tools/browseIntents.js";
import { decryptBalanceTool } from "./tools/decryptBalance.js";
import { keeperhubRelayTool } from "./tools/keeperhubRelay.js";

const server = new Server(
  {
    name: "private-otc",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

const tools = [
  createIntentTool,
  browseIntentsTool,
  decryptBalanceTool,
  keeperhubRelayTool,
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
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  return await tool.handler(request.params.arguments ?? {});
});

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("[mcp] private-otc server started");
