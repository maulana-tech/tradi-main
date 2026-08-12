"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";

interface Execution {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  errorCode?: string;
  errorCategory?: string;
  transactionHashes?: string[];
  gasUsedWei?: string;
  triggerSource?: string;
  completedSteps?: number;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "danger" | "warning"> = {
  completed: "success",
  success: "success",
  running: "warning",
  failed: "danger",
  error: "danger",
  pending: "neutral",
  deployed: "neutral",
};

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchExecutions = useCallback(async () => {
    try {
      const khRes = await fetch("/api/keeperhub/workflows?action=executions&limit=50");
      const khData = (await khRes.json()) as { ok: boolean; data?: { runs?: Execution[] } };

      let execs: Execution[] = [];
      if (khData.ok && khData.data?.runs) {
        execs = khData.data.runs;
      }

      setExecutions(execs);
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExecutions();
    const interval = setInterval(fetchExecutions, 10000);
    return () => clearInterval(interval);
  }, [fetchExecutions]);

  async function viewDetail(executionId: string) {
    setSelectedId(executionId);
    setLoadingDetail(true);
    setSelectedDetail("");
    try {
      const res = await fetch(`/api/keeperhub/workflows?action=execution&executionId=${executionId}`);
      const data = (await res.json()) as { ok: boolean; data?: Record<string, unknown> };
      if (data.ok && data.data) {
        setSelectedDetail(JSON.stringify(data.data, null, 2));
      } else {
        setSelectedDetail("No detail available");
      }
    } catch {
      setSelectedDetail("Failed to load detail");
    } finally {
      setLoadingDetail(false);
    }
  }

  const filtered = statusFilter === "all"
    ? executions
    : executions.filter((e) => e.status === statusFilter);

  const successCount = executions.filter((e) => e.status === "success").length;
  const errorCount = executions.filter((e) => e.status === "error").length;
  const runningCount = executions.filter((e) => e.status === "running").length;

  return (
    <AppShell>
      <PageHeader
        icon="terminal"
        title="Execution Logs"
        subtitle="View all KeeperHub workflow execution history and results."
        action={
          <Button tone="secondary" onClick={fetchExecutions}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-surface-low)]">
            <Icon name="receipt_long" className="size-4 text-[var(--color-text-muted)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{executions.length}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Total</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-success-soft)]">
            <Icon name="check_circle" className="size-4 text-[var(--color-success-text)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{successCount}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Success</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-danger-soft)]">
            <Icon name="error" className="size-4 text-[var(--color-danger-text)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{errorCount}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Error</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-warning-soft)]">
            <Icon name="sync" className="size-4 text-[var(--color-warning-text)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">{runningCount}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Running</p>
          </div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "success", "error", "running"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              statusFilter === s
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-white"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({s === "success" ? successCount : s === "error" ? errorCount : runningCount})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <Icon name="sync" className="mx-auto size-6 animate-spin text-[var(--color-primary-text)]" />
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading executions...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Icon name="terminal" className="mx-auto size-8 text-[var(--color-text-muted)]" />
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No executions yet. Deploy an agent to start.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-low)] text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Workflow</th>
                  <th className="px-5 py-3 font-medium">Started At</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Error</th>
                  <th className="px-5 py-3 font-medium">Trigger</th>
                  <th className="px-5 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((exec) => (
                  <tr
                    key={exec.id}
                    className={`transition-colors hover:bg-[var(--color-surface-low)] ${
                      selectedId === exec.id ? "bg-[var(--color-surface-low)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <Status
                        label={exec.status}
                        tone={STATUS_TONE[exec.status] ?? "neutral"}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-white">{exec.workflowName ?? exec.workflowId}</p>
                      <p className="font-mono text-xs text-[var(--color-text-muted)]">{exec.id}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                      {formatDate(exec.startedAt)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                      {formatDuration(exec.durationMs)}
                    </td>
                    <td className="px-5 py-3">
                      {exec.error ? (
                        <span className="text-xs text-[var(--color-danger-text)] line-clamp-2 max-w-[200px]">
                          {exec.error}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="neutral">{exec.triggerSource ?? "manual"}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => viewDetail(exec.id)}
                        className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-white"
                        title="View detail"
                      >
                        <Icon name="visibility" className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedId && (
        <Card className="mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Execution Detail</h3>
              <p className="font-mono text-xs text-[var(--color-text-muted)]">{selectedId}</p>
            </div>
            <button
              onClick={() => { setSelectedId(null); setSelectedDetail(""); }}
              className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-white"
            >
              <Icon name="close" className="size-4" />
            </button>
          </div>
          {loadingDetail ? (
            <div className="flex h-32 items-center justify-center">
              <Icon name="sync" className="size-5 animate-spin text-[var(--color-primary-text)]" />
            </div>
          ) : (
            <pre className="max-h-[400px] overflow-auto rounded-lg bg-[var(--color-surface-low)] p-4 font-mono text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {selectedDetail || "No detail data"}
            </pre>
          )}
        </Card>
      )}
    </AppShell>
  );
}
