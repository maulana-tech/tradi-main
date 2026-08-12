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
  error?: string;
  logs?: Array<{ timestamp: string; level: string; message: string; nodeId?: string }>;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "danger" | "warning"> = {
  completed: "success",
  running: "warning",
  failed: "danger",
  pending: "neutral",
};

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch("/api/keeperhub/workflows?action=executions&limit=50");
      const data = (await res.json()) as { ok: boolean; data?: Execution[] | { executions?: Execution[] } };
      if (data.ok && data.data) {
        const execs = Array.isArray(data.data) ? data.data : (data.data.executions ?? []);
        setExecutions(execs);
      }
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExecutions();
    const interval = setInterval(fetchExecutions, 15000);
    return () => clearInterval(interval);
  }, [fetchExecutions]);

  async function viewLogs(executionId: string) {
    setSelectedId(executionId);
    setLoadingLogs(true);
    setSelectedLogs("");
    try {
      const res = await fetch(`/api/keeperhub/workflows?action=execution&executionId=${executionId}`);
      const data = (await res.json()) as { ok: boolean; data?: { logs?: string | unknown[]; status?: string; error?: string } };
      if (data.ok && data.data) {
        const d = data.data;
        const logText = typeof d.logs === "string" ? d.logs : JSON.stringify(d.logs, null, 2);
        setSelectedLogs(logText || JSON.stringify(d, null, 2));
      } else {
        setSelectedLogs("No logs available");
      }
    } catch {
      setSelectedLogs("Failed to load logs");
    } finally {
      setLoadingLogs(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        icon="terminal"
        title="Execution Logs"
        subtitle="View KeeperHub workflow execution history and logs."
        action={
          <Button tone="secondary" onClick={fetchExecutions}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">Recent Executions</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Card key={i} className="h-20 animate-pulse p-5" />)}
            </div>
          ) : executions.length === 0 ? (
            <Card className="p-8 text-center">
              <Icon name="terminal" className="mx-auto size-8 text-[var(--color-text-muted)]" />
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No executions yet. Deploy an agent to start.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {executions.map((exec) => (
                <button
                  key={exec.id}
                  onClick={() => viewLogs(exec.id)}
                  className={`w-full text-left transition ${selectedId === exec.id ? "ring-1 ring-[var(--color-primary)]" : ""}`}
                >
                  <Card className="p-4 hover:bg-[var(--color-surface-raised)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Status label={exec.status} tone={STATUS_TONE[exec.status] ?? "neutral"} />
                        <div>
                          <p className="text-sm font-medium text-white">{exec.workflowName ?? exec.workflowId}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {new Date(exec.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Icon name="chevron_right" className="size-4 text-[var(--color-text-muted)]" />
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">Execution Details</h3>
          <Card className="min-h-[400px] p-4">
            {selectedId === null ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-[var(--color-text-muted)]">Select an execution to view logs</p>
              </div>
            ) : loadingLogs ? (
              <div className="flex h-64 items-center justify-center">
                <Icon name="sync" className="size-6 animate-spin text-[var(--color-primary-text)]" />
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--color-text-muted)]">{selectedId}</span>
                  <button
                    onClick={() => { setSelectedId(null); setSelectedLogs(""); }}
                    className="text-xs text-[var(--color-text-muted)] hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <pre className="max-h-[500px] overflow-auto rounded-lg bg-[var(--color-surface-low)] p-4 font-mono text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
                  {selectedLogs || "No log data"}
                </pre>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
