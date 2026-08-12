"use client";

import { useState, useCallback } from "react";
import { encodeFunctionData } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

export type KHStep = "idle" | "encrypting" | "simulating" | "executing" | "confirming" | "done" | "error";

export interface KHState {
  step: KHStep;
  executionId: string | null;
  txHash: string | null;
  txLink: string | null;
  gasUsed: string | null;
  sponsored: boolean | null;
  error: string | null;
}

const initial: KHState = {
  step: "idle",
  executionId: null,
  txHash: null,
  txLink: null,
  gasUsed: null,
  sponsored: null,
  error: null,
};

export function useKeeperHubWrite() {
  const [state, setState] = useState<KHState>(initial);

  const reset = useCallback(() => setState(initial), []);

  const execute = useCallback(async (params: {
    functionName: string;
    args: unknown[];
    onStep?: (step: KHStep) => void;
  }): Promise<KHState> => {
    const { functionName, args, onStep } = params;

    const setStep = (step: KHStep, extra: Partial<KHState> = {}) => {
      setState((s) => ({ ...s, step, ...extra }));
      onStep?.(step);
    };

    // Encode calldata
    const calldata = encodeFunctionData({
      abi: privateOtcAbi,
      functionName: functionName as never,
      args: args as never,
    });

    // Simulate
    setStep("simulating");

    try {
      const simRes = await fetch("/api/keeperhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          chain_id: "421614",
          contract_address: PRIVATE_OTC_ADDRESS,
          function_name: functionName,
          abi: privateOtcAbi,
          args,
        }),
      });
      const simData = (await simRes.json()) as { ok: boolean; data?: { wouldRevert?: boolean; error?: string }; error?: string };

      if (!simData.ok) {
        setStep("error", { error: `Simulation failed: ${simData.error}` });
        return { ...state, step: "error", error: simData.error ?? "Simulation failed" };
      }

      if (simData.data?.wouldRevert) {
        const err = `Simulation reverted: ${simData.data.error ?? "unknown"}`;
        setStep("error", { error: err });
        return { ...state, step: "error", error: err };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStep("error", { error: `Simulation error: ${msg}` });
      return { ...state, step: "error", error: msg };
    }

    // Execute
    setStep("executing");

    let execData: { ok: boolean; data?: Record<string, unknown>; error?: string };
    try {
      const execRes = await fetch("/api/keeperhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          chain_id: "421614",
          contract_address: PRIVATE_OTC_ADDRESS,
          function_name: functionName,
          abi: privateOtcAbi,
          args,
          idempotencyKey: `tradi-${functionName}-${Date.now()}`,
        }),
      });
      execData = (await execRes.json()) as { ok: boolean; data?: Record<string, unknown>; error?: string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStep("error", { error: `Execution error: ${msg}` });
      return { ...state, step: "error", error: msg };
    }

    if (!execData.ok) {
      setStep("error", { error: execData.error ?? "Execution failed" });
      return { ...state, step: "error", error: execData.error ?? "Execution failed" };
    }

    const executionId = (execData.data?.executionId as string) ?? null;
    const sponsored = (execData.data?.sponsored as boolean) ?? null;

    setStep("confirming", { executionId, sponsored });

    // Poll
    if (executionId) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const pollRes = await fetch(`/api/keeperhub?action=status&executionId=${executionId}`);
          const pollData = (await pollRes.json()) as { ok: boolean; data?: Record<string, unknown> };
          if (!pollData.ok || !pollData.data) continue;

          const status = pollData.data.status as string;

          if (status === "completed") {
            const final: KHState = {
              step: "done",
              executionId,
              txHash: (pollData.data.transactionHash as string) ?? null,
              txLink: (pollData.data.transactionLink as string) ?? null,
              gasUsed: (pollData.data.gasUsed as string) ?? null,
              sponsored: (pollData.data.sponsored as boolean) ?? sponsored,
              error: null,
            };
            setState(final);

            // Push success notification
            try {
              await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "success",
                  source: "keeperhub",
                  title: `${functionName} succeeded`,
                  message: `Tx: ${final.txHash?.slice(0, 10)}... | Gas: ${final.gasUsed ?? "—"}`,
                  executionId,
                  txHash: final.txHash,
                  txLink: final.txLink,
                }),
              });
            } catch { /* silent */ }

            return final;
          }

          if (status === "failed") {
            const final: KHState = {
              step: "error",
              executionId,
              txHash: (pollData.data.transactionHash as string) ?? null,
              txLink: (pollData.data.transactionLink as string) ?? null,
              gasUsed: (pollData.data.gasUsed as string) ?? null,
              sponsored: null,
              error: (pollData.data.error as string) ?? "Execution failed",
            };
            setState(final);

            // Push error notification
            try {
              await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "error",
                  source: "keeperhub",
                  title: `${functionName} failed`,
                  message: final.error,
                  executionId,
                }),
              });
            } catch { /* silent */ }

            return final;
          }
        } catch { /* continue polling */ }
      }

      // Timeout
      const timeout: KHState = {
        step: "error",
        executionId,
        txHash: null,
        txLink: null,
        gasUsed: null,
        sponsored,
        error: "Polling timeout — check KeeperHub dashboard",
      };
      setState(timeout);
      return timeout;
    }

    // Direct result (no executionId)
    const direct: KHState = {
      step: "done",
      executionId: null,
      txHash: (execData.data?.transactionHash as string) ?? null,
      txLink: (execData.data?.transactionLink as string) ?? null,
      gasUsed: (execData.data?.gasUsed as string) ?? null,
      sponsored,
      error: null,
    };
    setState(direct);
    return direct;
  }, [state]);

  return { state, execute, reset };
}
