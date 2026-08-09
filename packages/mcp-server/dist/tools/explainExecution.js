import { z } from "zod";
const ArgsSchema = z.object({
    executionId: z.string().min(1),
    status: z.string().optional(),
    txHash: z.string().optional(),
    gasUsed: z.string().optional(),
    sponsored: z.boolean().optional(),
    error: z.string().optional(),
});
export const explainExecutionTool = {
    name: "private_otc_explain_execution",
    description: "Explain the outcome of a KeeperHub execution. Pass the execution details to get a human-readable summary with next steps. Use this after KeeperHub returns a result.",
    inputSchema: {
        type: "object",
        properties: {
            executionId: { type: "string", description: "KeeperHub execution ID" },
            status: { type: "string", description: "Execution status (completed, failed, etc.)" },
            txHash: { type: "string", description: "Transaction hash if available" },
            gasUsed: { type: "string", description: "Gas used" },
            sponsored: { type: "boolean", description: "Whether gas was sponsored" },
            error: { type: "string", description: "Error message if failed" },
        },
        required: ["executionId"],
    },
    async handler(rawArgs) {
        const args = ArgsSchema.parse(rawArgs);
        const isTerminal = args.status === "failed" || args.error !== undefined;
        const isSuccess = args.status === "completed";
        let summary;
        let nextSteps;
        if (isSuccess) {
            summary = `Execution ${args.executionId} completed successfully.`;
            nextSteps = [
                "Verify the transaction on Arbiscan using the tx link.",
                "Check that the intent status has changed on-chain.",
                "Update your audit log with the final receipt.",
            ];
        }
        else if (isTerminal) {
            summary = `Execution ${args.executionId} failed: ${args.error ?? "unknown error"}`;
            nextSteps = [
                "Do NOT retry — the error is terminal.",
                "Check if the intent is still in the correct state.",
                "Verify operator permissions and token balances.",
                "Review the ABI and calldata for correctness.",
            ];
        }
        else {
            summary = `Execution ${args.executionId} is in progress (status: ${args.status ?? "unknown"}).`;
            nextSteps = [
                "Continue polling get_direct_execution_status.",
                "Set a bounded timeout to avoid infinite polling.",
            ];
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        executionId: args.executionId,
                        status: args.status ?? "unknown",
                        txHash: args.txHash ?? null,
                        txLink: args.txHash ? `https://sepolia.arbiscan.io/tx/${args.txHash}` : null,
                        gasUsed: args.gasUsed ?? null,
                        sponsored: args.sponsored ?? null,
                        error: args.error ?? null,
                        summary,
                        nextSteps,
                        isTerminal,
                        isSuccess,
                    }, null, 2),
                },
            ],
        };
    },
};
//# sourceMappingURL=explainExecution.js.map