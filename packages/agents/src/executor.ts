/**
 * Shared KeeperHub Executor
 *
 * Flow: prepare → simulate → execute once → bounded poll → persist audit
 *
 * When KEEPERHUB_MCP_URL is set, all writes go through KeeperHub MCP/API.
 * When not set, falls back to direct Viem (local dev only).
 *
 * No blind retries on terminal errors (revert, ABI wrong, balance low, operator not active).
 * Retries only for transient errors (timeout, rate limit, server error).
 */

import { publicClient, walletClient, env } from "./config.js";

export interface ExecuteParams {
  target: `0x${string}`;
  calldata: `0x${string}`;
  functionName: string;
  intentId: string;
  action: string;
  decision: string;
  reason: string;
}

export interface AuditRecord {
  intentId: string;
  action: string;
  decision: string;
  reason: string;
  executionId: string | null;
  status: "simulating" | "submitted" | "confirming" | "success" | "failed";
  transactionHash: string | null;
  transactionLink: string | null;
  gasUsed: string | null;
  sponsored: boolean | null;
  routedVia: "keeperhub" | "viem-fallback";
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface ExecuteResult {
  ok: boolean;
  audit: AuditRecord;
}

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 3000;

const TERMINAL_ERRORS = [
  "execution reverted",
  "revert",
  "not operator",
  "insufficient balance",
  "allowance",
  "abi",
  "invalid",
  "not open",
  "deadline passed",
  "max bids reached",
];

function isTerminalError(error: string): boolean {
  const lower = error.toLowerCase();
  return TERMINAL_ERRORS.some((e) => lower.includes(e));
}

function now(): string {
  return new Date().toISOString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function keeperhubRequest(
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const mcpUrl = process.env.KEEPERHUB_MCP_URL;
  if (!mcpUrl) throw new Error("KEEPERHUB_MCP_URL not set");

  const apiKey = process.env.KEEPERHUB_API_KEY;
  if (!apiKey) throw new Error("KEEPERHUB_API_KEY not set");

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: method,
        arguments: params,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KeeperHub ${response.status}: ${text}`);
  }

  const body = (await response.json()) as {
    result?: { content?: Array<{ type: string; text: string }> };
    error?: { message: string };
  };

  if (body.error) throw new Error(`KeeperHub error: ${body.error.message}`);

  const text = body.result?.content?.[0]?.text;
  if (!text) throw new Error("KeeperHub returned empty response");

  return JSON.parse(text) as Record<string, unknown>;
}

async function executeViaKeeperHubMcp(
  params: ExecuteParams,
): Promise<AuditRecord> {
  const baseAudit: AuditRecord = {
    intentId: params.intentId,
    action: params.action,
    decision: params.decision,
    reason: params.reason,
    executionId: null,
    status: "simulating",
    transactionHash: null,
    transactionLink: null,
    gasUsed: null,
    sponsored: null,
    routedVia: "keeperhub",
    createdAt: now(),
    completedAt: null,
    error: null,
  };

  // Step 1: Simulate
  let simResult: Record<string, unknown>;
  try {
    simResult = await keeperhubRequest("execute_contract_call", {
      target: params.target,
      calldata: params.calldata,
      simulate: true,
    });
  } catch (err) {
    return {
      ...baseAudit,
      status: "failed",
      error: `Simulation request failed: ${err instanceof Error ? err.message : String(err)}`,
      completedAt: now(),
    };
  }

  const wouldRevert = simResult.wouldRevert === true;
  if (wouldRevert) {
    return {
      ...baseAudit,
      status: "failed",
      error: `Simulation reverted: ${simResult.error ?? "unknown reason"}`,
      completedAt: now(),
    };
  }

  // Step 2: Execute
  const idempotencyKey = `${params.intentId}-${params.action}-${Date.now()}`;
  let execResult: Record<string, unknown>;
  try {
    execResult = await keeperhubRequest("execute_contract_call", {
      target: params.target,
      calldata: params.calldata,
      simulate: false,
      idempotencyKey,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ...baseAudit,
      status: "failed",
      error: `Execution request failed: ${errMsg}`,
      completedAt: now(),
    };
  }

  const executionId = (execResult.executionId as string) ?? null;
  const submittedAudit: AuditRecord = {
    ...baseAudit,
    status: "submitted",
    executionId,
    sponsored: (execResult.sponsored as boolean) ?? null,
  };

  if (!executionId) {
    return {
      ...submittedAudit,
      status: "failed",
      error: "KeeperHub returned no executionId",
      completedAt: now(),
    };
  }

  // Step 3: Poll
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);

    let pollResult: Record<string, unknown>;
    try {
      pollResult = await keeperhubRequest("get_direct_execution_status", {
        executionId,
      });
    } catch (err) {
      // Transient poll error — continue polling
      continue;
    }

    const pollStatus = pollResult.status as string;

    if (pollStatus === "completed") {
      return {
        ...submittedAudit,
        status: "success",
        transactionHash: (pollResult.transactionHash as string) ?? null,
        transactionLink: (pollResult.transactionLink as string) ?? null,
        gasUsed: (pollResult.gasUsed as string) ?? null,
        sponsored: (pollResult.sponsored as boolean) ?? submittedAudit.sponsored,
        completedAt: now(),
      };
    }

    if (pollStatus === "failed") {
      return {
        ...submittedAudit,
        status: "failed",
        error: (pollResult.error as string) ?? "Execution failed",
        transactionHash: (pollResult.transactionHash as string) ?? null,
        transactionLink: (pollResult.transactionLink as string) ?? null,
        gasUsed: (pollResult.gasUsed as string) ?? null,
        completedAt: now(),
      };
    }

    // Still in progress — update status
    submittedAudit.status = pollStatus === "submitted" ? "submitted" : "confirming";
  }

  // Timeout
  return {
    ...submittedAudit,
    status: "failed",
    error: `Polling timeout after ${MAX_POLLS} attempts (${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s)`,
    completedAt: now(),
  };
}

async function executeViaViem(params: ExecuteParams): Promise<AuditRecord> {
  const baseAudit: AuditRecord = {
    intentId: params.intentId,
    action: params.action,
    decision: params.decision,
    reason: params.reason,
    executionId: null,
    status: "simulating",
    transactionHash: null,
    transactionLink: null,
    gasUsed: null,
    sponsored: false,
    routedVia: "viem-fallback",
    createdAt: now(),
    completedAt: null,
    error: null,
  };

  try {
    // Simulate first
    const { request } = await publicClient.simulateContract({
      address: params.target,
      abi: [{ type: "function", name: params.functionName, inputs: [], outputs: [] }],
      functionName: params.functionName,
      account: walletClient.account,
    });

    // Execute
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      ...baseAudit,
      status: "success",
      transactionHash: txHash,
      transactionLink: `https://sepolia.arbiscan.io/tx/${txHash}`,
      gasUsed: receipt.gasUsed.toString(),
      completedAt: now(),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      ...baseAudit,
      status: "failed",
      error: errMsg,
      completedAt: now(),
    };
  }
}

/**
 * Execute a transaction via KeeperHub MCP (preferred) or Viem fallback (local dev only).
 *
 * When KEEPERHUB_MCP_URL is set, uses KeeperHub for simulate + execute + poll.
 * Otherwise falls back to direct Viem (local development only).
 */
export async function execute(params: ExecuteParams): Promise<ExecuteResult> {
  const useKeeperHub = !!process.env.KEEPERHUB_MCP_URL;

  console.log(
    `[executor] ${params.action} for intent ${params.intentId} via ${useKeeperHub ? "KeeperHub" : "Viem"}`,
  );

  let audit: AuditRecord;

  if (useKeeperHub) {
    audit = await executeViaKeeperHubMcp(params);
  } else {
    console.warn(
      "[executor] KEEPERHUB_MCP_URL not set — using Viem fallback (local dev only)",
    );
    audit = await executeViaViem(params);
  }

  // Log outcome
  if (audit.status === "success") {
    console.log(
      `[executor] ${params.action} succeeded: tx=${audit.transactionHash} gas=${audit.gasUsed} sponsored=${audit.sponsored}`,
    );
  } else if (audit.status === "failed") {
    console.error(
      `[executor] ${params.action} failed: ${audit.error}`,
    );
  }

  return { ok: audit.status === "success", audit };
}
