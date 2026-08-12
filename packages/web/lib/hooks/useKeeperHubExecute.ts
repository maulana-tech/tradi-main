"use client";

import { useState, useCallback } from "react";
import { encodeFunctionData } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

export type KeeperHubStep = "idle" | "simulating" | "executing" | "confirming" | "success" | "failed";

export interface KeeperHubResult {
  step: KeeperHubStep;
  executionId: string | null;
  txHash: string | null;
  txLink: string | null;
  gasUsed: string | null;
  sponsored: boolean | null;
  error: string | null;
}

const initial: KeeperHubResult = {
  step: "idle",
  executionId: null,
  txHash: null,
  txLink: null,
  gasUsed: null,
  sponsored: null,
  error: null,
};

async function keeperhubCall(action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/keeperhub?action=${action}`, {
    method: action === "simulate" || action === "execute" ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(action === "simulate" || action === "execute" ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: string };
  if (!data.ok) throw new Error(data.error ?? "KeeperHub call failed");
  return data.data!;
}

export function useKeeperHubExecute() {
  const [result, setResult] = useState<KeeperHubResult>(initial);

  const reset = useCallback(() => setResult(initial), []);

  const execute = useCallback(async (params: {
    functionName: string;
    args: unknown[];
    abi?: unknown[];
  }): Promise<KeeperHubResult> => {
    const abi = params.abi ?? privateOtcAbi;

    // Encode calldata
    const calldata = encodeFunctionData({
      abi,
      functionName: params.functionName,
      args: params.args as never,
    });

    // Step 1: Simulate
    setResult({ ...initial, step: "simulating" });

    let simResult: Record<string, unknown>;
    try {
      simResult = await keeperhubCall("simulate", {
        chain_id: "421614",
        contract_address: PRIVATE_OTC_ADDRESS,
        function_name: params.functionName,
        abi,
        args: params.args,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setResult({ ...initial, step: "failed", error: `Simulation failed: ${error}` });
      return { ...initial, step: "failed", error };
    }

    if (simResult.wouldRevert) {
      const error = `Simulation reverted: ${simResult.error ?? "unknown reason"}`;
      setResult({ ...initial, step: "failed", error });
      return { ...initial, step: "failed", error };
    }

    // Step 2: Execute
    setResult({ ...initial, step: "executing" });

    let execResult: Record<string, unknown>;
    try {
      execResult = await keeperhubCall("execute", {
        chain_id: "421614",
        contract_address: PRIVATE_OTC_ADDRESS,
        function_name: params.functionName,
        abi,
        args: params.args,
        idempotencyKey: `tradi-${params.functionName}-${Date.now()}`,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setResult({ ...initial, step: "failed", error: `Execution failed: ${error}` });
      return { ...initial, step: "failed", error };
    }

    const executionId = (execResult.executionId as string) ?? null;
    setResult({
      step: "confirming",
      executionId,
      txHash: null,
      txLink: null,
      gasUsed: null,
      sponsored: (execResult.sponsored as boolean) ?? null,
      error: null,
    });

    // Step 3: Poll status
    if (executionId) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));

        try {
          const status = await keeperhubCall("status", { executionId });

          if (status.status === "completed") {
            const final: KeeperHubResult = {
              step: "success",
              executionId,
              txHash: (status.transactionHash as string) ?? null,
              txLink: (status.transactionLink as string) ?? null,
              gasUsed: (status.gasUsed as string) ?? null,
              sponsored: (status.sponsored as boolean) ?? null,
              error: null,
            };
            setResult(final);

            // Push notification
            try {
              await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "success",
                  source: "keeperhub",
                  title: `${params.functionName} succeeded`,
                  message: `Transaction confirmed. Gas: ${final.gasUsed ?? "—"}`,
                  executionId,
                  txHash: final.txHash,
                  txLink: final.txLink,
                }),
              });
            } catch { /* silent */ }

            return final;
          }

          if (status.status === "failed") {
            const final: KeeperHubResult = {
              step: "failed",
              executionId,
              txHash: (status.transactionHash as string) ?? null,
              txLink: (status.transactionLink as string) ?? null,
              gasUsed: (status.gasUsed as string) ?? null,
              sponsored: null,
              error: (status.error as string) ?? "Execution failed",
            };
            setResult(final);

            // Push notification
            try {
              await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "error",
                  source: "keeperhub",
                  title: `${params.functionName} failed`,
                  message: final.error,
                  executionId,
                }),
              });
            } catch { /* silent */ }

            return final;
          }
        } catch {
          // Continue polling
        }
      }

      // Timeout
      const timeout: KeeperHubResult = {
        step: "failed",
        executionId,
        txHash: null,
        txLink: null,
        gasUsed: null,
        sponsored: null,
        error: "Polling timeout — check KeeperHub dashboard",
      };
      setResult(timeout);
      return timeout;
    }

    // No execution ID — direct result
    const direct: KeeperHubResult = {
      step: "success",
      executionId: null,
      txHash: (execResult.transactionHash as string) ?? null,
      txLink: (execResult.transactionLink as string) ?? null,
      gasUsed: (execResult.gasUsed as string) ?? null,
      sponsored: (execResult.sponsored as boolean) ?? null,
      error: null,
    };
    setResult(direct);
    return direct;
  }, []);

  return { result, execute, reset };
}
