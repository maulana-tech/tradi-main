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
import { publicClient, walletClient } from "./config.js";
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
function isTerminalError(error) {
    const lower = error.toLowerCase();
    return TERMINAL_ERRORS.some((e) => lower.includes(e));
}
function now() {
    return new Date().toISOString();
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function keeperhubRequest(method, params) {
    const mcpUrl = process.env.KEEPERHUB_MCP_URL;
    if (!mcpUrl)
        throw new Error("KEEPERHUB_MCP_URL not set");
    const apiKey = process.env.KEEPERHUB_API_KEY;
    if (!apiKey)
        throw new Error("KEEPERHUB_API_KEY not set");
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
    const body = (await response.json());
    if (body.error)
        throw new Error(`KeeperHub error: ${body.error.message}`);
    const text = body.result?.content?.[0]?.text;
    if (!text)
        throw new Error("KeeperHub returned empty response");
    return JSON.parse(text);
}
async function executeViaKeeperHubMcp(params) {
    const baseAudit = {
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
    let simResult;
    try {
        simResult = await keeperhubRequest("execute_contract_call", {
            target: params.target,
            calldata: params.calldata,
            simulate: true,
        });
    }
    catch (err) {
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
    let execResult;
    try {
        execResult = await keeperhubRequest("execute_contract_call", {
            target: params.target,
            calldata: params.calldata,
            simulate: false,
            idempotencyKey,
        });
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
            ...baseAudit,
            status: "failed",
            error: `Execution request failed: ${errMsg}`,
            completedAt: now(),
        };
    }
    const executionId = execResult.executionId ?? null;
    const submittedAudit = {
        ...baseAudit,
        status: "submitted",
        executionId,
        sponsored: execResult.sponsored ?? null,
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
        let pollResult;
        try {
            pollResult = await keeperhubRequest("get_direct_execution_status", {
                executionId,
            });
        }
        catch (err) {
            // Transient poll error — continue polling
            continue;
        }
        const pollStatus = pollResult.status;
        if (pollStatus === "completed") {
            return {
                ...submittedAudit,
                status: "success",
                transactionHash: pollResult.transactionHash ?? null,
                transactionLink: pollResult.transactionLink ?? null,
                gasUsed: pollResult.gasUsed ?? null,
                sponsored: pollResult.sponsored ?? submittedAudit.sponsored,
                completedAt: now(),
            };
        }
        if (pollStatus === "failed") {
            return {
                ...submittedAudit,
                status: "failed",
                error: pollResult.error ?? "Execution failed",
                transactionHash: pollResult.transactionHash ?? null,
                transactionLink: pollResult.transactionLink ?? null,
                gasUsed: pollResult.gasUsed ?? null,
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
async function executeViaViem(params) {
    const baseAudit = {
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
    }
    catch (err) {
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
export async function execute(params) {
    const useKeeperHub = !!process.env.KEEPERHUB_MCP_URL;
    console.log(`[executor] ${params.action} for intent ${params.intentId} via ${useKeeperHub ? "KeeperHub" : "Viem"}`);
    let audit;
    if (useKeeperHub) {
        audit = await executeViaKeeperHubMcp(params);
    }
    else {
        console.warn("[executor] KEEPERHUB_MCP_URL not set — using Viem fallback (local dev only)");
        audit = await executeViaViem(params);
    }
    // Log outcome
    if (audit.status === "success") {
        console.log(`[executor] ${params.action} succeeded: tx=${audit.transactionHash} gas=${audit.gasUsed} sponsored=${audit.sponsored}`);
    }
    else if (audit.status === "failed") {
        console.error(`[executor] ${params.action} failed: ${audit.error}`);
    }
    return { ok: audit.status === "success", audit };
}
//# sourceMappingURL=executor.js.map