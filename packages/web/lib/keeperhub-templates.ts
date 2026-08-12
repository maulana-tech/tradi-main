/**
 * KeeperHub workflow templates for each strategy.
 * These define the actual workflow structure that gets created on KeeperHub.
 */

const PRIVATE_OTC = "0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4";
const CHAIN_ID = "421614"; // Arbitrum Sepolia

const PRIVATE_OTC_ABI = {
  intents: [{ type: "function", name: "intents", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "maker", type: "address" }, { name: "sellToken", type: "address" }, { name: "buyToken", type: "address" }, { name: "sellAmount", type: "bytes32" }, { name: "minBuyAmount", type: "bytes32" }, { name: "deadline", type: "uint64" }, { name: "status", type: "uint8" }, { name: "mode", type: "uint8" }, { name: "allowedTaker", type: "address" }] }],
  nextIntentId: [{ type: "function", name: "nextIntentId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
  submitBid: [{ type: "function", name: "submitBid", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "bidAmountHandle", type: "bytes32" }, { name: "bidProof", type: "bytes" }], outputs: [] }],
  finalizeRFQ: [{ type: "function", name: "finalizeRFQ", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] }],
};

export interface WorkflowTemplate {
  name: string;
  description: string;
  nodes: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

export function getWorkflowTemplate(strategyId: string, config: Record<string, string>): WorkflowTemplate | null {
  switch (strategyId) {
    case "rfq-market-maker":
      return marketMakerWorkflow(config);
    case "rfq-sweeper":
      return sweeperWorkflow(config);
    case "settlement-monitor":
      return settlementMonitorWorkflow(config);
    case "strategy-coach":
      return strategyCoachWorkflow(config);
    default:
      return null;
  }
}

function marketMakerWorkflow(config: Record<string, string>): WorkflowTemplate {
  return {
    name: `Tradi: RFQ Market Maker`,
    description: `Auto-bid on RFQ auctions. Spread: ${config.spreadBps ?? 30} bps. Pairs: ${config.pairs ?? "cETH/cUSDC"}`,
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        data: { type: "trigger", label: "Every 2 minutes", config: { triggerType: "Schedule", scheduleCron: "*/2 * * * *", scheduleTimezone: "UTC" }, status: "idle" },
        position: { x: 0, y: 0 },
      },
      {
        id: "read-intents",
        type: "action",
        data: {
          type: "action",
          label: "Read Next Intent ID",
          config: {
            actionType: "web3/read-contract",
            network: CHAIN_ID,
            contractAddress: PRIVATE_OTC,
            abi: JSON.stringify(PRIVATE_OTC_ABI.nextIntentId),
            functionName: "nextIntentId",
            abiFunction: "nextIntentId() returns (uint256)",
            args: "[]",
          },
          status: "idle",
          description: "Get the latest intent count from PrivateOTC",
        },
        position: { x: 250, y: 0 },
      },
      {
        id: "read-latest",
        type: "action",
        data: {
          type: "action",
          label: "Read Latest RFQ",
          config: {
            actionType: "web3/read-contract",
            network: CHAIN_ID,
            contractAddress: PRIVATE_OTC,
            abi: JSON.stringify(PRIVATE_OTC_ABI.intents),
            functionName: "intents",
            abiFunction: "intents(uint256) returns (address,address,address,bytes32,bytes32,uint64,uint8,uint8,address)",
            args: JSON.stringify(["{{@read-intents:Read Next Intent ID.result}} - 1"]),
          },
          status: "idle",
          description: "Read the latest intent to check if it's an open RFQ",
        },
        position: { x: 500, y: 0 },
      },
      {
        id: "notify",
        type: "action",
        data: {
          type: "action",
          label: "Log Activity",
          config: {
            actionType: "webhook/send",
            url: "{{WEBHOOK_URL}}",
            method: "POST",
            body: JSON.stringify({
              event: "rfq_scan",
              intentId: "{{@read-intents:Read Next Intent ID.result}}",
              timestamp: "{{now}}",
            }),
          },
          status: "idle",
          description: "Log scan activity to webhook",
        },
        position: { x: 750, y: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "read-intents" },
      { id: "e2", source: "read-intents", target: "read-latest" },
      { id: "e3", source: "read-latest", target: "notify" },
    ],
  };
}

function sweeperWorkflow(config: Record<string, string>): WorkflowTemplate {
  const interval = config.scanInterval ?? "5";
  return {
    name: `Tradi: RFQ Finalizer`,
    description: `Scan every ${interval} minutes for expired RFQs and finalize them.`,
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        data: { type: "trigger", label: `Every ${interval} minutes`, config: { triggerType: "Schedule", scheduleCron: `*/${interval} * * * *`, scheduleTimezone: "UTC" }, status: "idle" },
        position: { x: 0, y: 0 },
      },
      {
        id: "read-next",
        type: "action",
        data: {
          type: "action",
          label: "Read Intent Count",
          config: {
            actionType: "web3/read-contract",
            network: CHAIN_ID,
            contractAddress: PRIVATE_OTC,
            abi: JSON.stringify(PRIVATE_OTC_ABI.nextIntentId),
            functionName: "nextIntentId",
            abiFunction: "nextIntentId() returns (uint256)",
            args: "[]",
          },
          status: "idle",
        },
        position: { x: 250, y: 0 },
      },
      {
        id: "notify",
        type: "action",
        data: {
          type: "action",
          label: "Log Scan",
          config: {
            actionType: "webhook/send",
            url: "{{WEBHOOK_URL}}",
            method: "POST",
            body: JSON.stringify({ event: "sweep_scan", totalIntents: "{{@read-next:Read Intent Count.result}}", timestamp: "{{now}}" }),
          },
          status: "idle",
        },
        position: { x: 500, y: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "read-next" },
      { id: "e2", source: "read-next", target: "notify" },
    ],
  };
}

function settlementMonitorWorkflow(config: Record<string, string>): WorkflowTemplate {
  return {
    name: `Tradi: Settlement Monitor`,
    description: "Monitor PrivateOTC for settlement events and notify via webhook.",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        data: { type: "trigger", label: "Every 5 minutes", config: { triggerType: "Schedule", scheduleCron: "*/5 * * * *", scheduleTimezone: "UTC" }, status: "idle" },
        position: { x: 0, y: 0 },
      },
      {
        id: "read-next",
        type: "action",
        data: {
          type: "action",
          label: "Check Intent Count",
          config: {
            actionType: "web3/read-contract",
            network: CHAIN_ID,
            contractAddress: PRIVATE_OTC,
            abi: JSON.stringify(PRIVATE_OTC_ABI.nextIntentId),
            functionName: "nextIntentId",
            abiFunction: "nextIntentId() returns (uint256)",
            args: "[]",
          },
          status: "idle",
        },
        position: { x: 250, y: 0 },
      },
      {
        id: "notify",
        type: "action",
        data: {
          type: "action",
          label: "Report",
          config: {
            actionType: "webhook/send",
            url: config.webhookUrl || "{{WEBHOOK_URL}}",
            method: "POST",
            body: JSON.stringify({ event: "settlement_check", totalIntents: "{{@read-next:Check Intent Count.result}}", timestamp: "{{now}}" }),
          },
          status: "idle",
        },
        position: { x: 500, y: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "read-next" },
      { id: "e2", source: "read-next", target: "notify" },
    ],
  };
}

function strategyCoachWorkflow(config: Record<string, string>): WorkflowTemplate {
  return {
    name: `Tradi: Strategy Coach`,
    description: "Daily performance report — scan intents and report stats.",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        data: { type: "trigger", label: "Daily", config: { triggerType: "Schedule", scheduleCron: "0 9 * * *", scheduleTimezone: "UTC" }, status: "idle" },
        position: { x: 0, y: 0 },
      },
      {
        id: "read-next",
        type: "action",
        data: {
          type: "action",
          label: "Read Total Intents",
          config: {
            actionType: "web3/read-contract",
            network: CHAIN_ID,
            contractAddress: PRIVATE_OTC,
            abi: JSON.stringify(PRIVATE_OTC_ABI.nextIntentId),
            functionName: "nextIntentId",
            abiFunction: "nextIntentId() returns (uint256)",
            args: "[]",
          },
          status: "idle",
        },
        position: { x: 250, y: 0 },
      },
      {
        id: "report",
        type: "action",
        data: {
          type: "action",
          label: "Send Report",
          config: {
            actionType: "webhook/send",
            url: config.webhookUrl || "{{WEBHOOK_URL}}",
            method: "POST",
            body: JSON.stringify({ event: "daily_report", totalIntents: "{{@read-next:Read Total Intents.result}}", date: "{{now}}" }),
          },
          status: "idle",
        },
        position: { x: 500, y: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "read-next" },
      { id: "e2", source: "read-next", target: "report" },
    ],
  };
}
