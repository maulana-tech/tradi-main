"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { getStrategy } from "@/lib/strategies";
import { Button } from "@/components/ui/Button";

type AgentStatus = "running" | "stopped" | "error" | "deploying";
type WriterMode = "hermes" | "agent" | "dry-run";

interface DeployedAgent {
  id: string;
  strategyId: string;
  name: string;
  status: AgentStatus;
  writerMode: WriterMode;
  deployedAt: string;
  lastRun: string | null;
  runs: number;
  errors: number;
  config: Record<string, string>;
}

const STATUS_TONE: Record<AgentStatus, "success" | "neutral" | "danger" | "warning"> = {
  running: "success",
  stopped: "neutral",
  error: "danger",
  deploying: "warning",
};

const MODE_LABEL: Record<WriterMode, string> = {
  agent: "Auto",
  hermes: "Hermes",
  "dry-run": "Dry Run",
};

export default function DashboardPage() {
  const [agents, setAgents] = useState<DeployedAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = (await res.json()) as { agents: DeployedAgent[] };
      setAgents(data.agents);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  async function handleAction(id: string, action: "start" | "stop" | "delete") {
    try {
      const res = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) void fetchAgents();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    }
  }

  const running = agents.filter((a) => a.status === "running").length;
  const stopped = agents.filter((a) => a.status === "stopped").length;
  const errors = agents.filter((a) => a.status === "error").length;

  return (
    <AppShell>
      <PageHeader
        icon="dashboard"
        title="Agent Dashboard"
        subtitle="Monitor and manage your deployed trading agents."
        action={
          <Link
            href="/strategies"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Icon name="add" className="size-4" />
            Deploy Agent
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-success-soft)]">
            <Icon name="play_circle" className="size-5 text-[var(--color-success-text)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{running}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Running</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-surface-low)]">
            <Icon name="pause_circle" className="size-5 text-[var(--color-text-muted)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stopped}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Stopped</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-danger-soft)]">
            <Icon name="error" className="size-5 text-[var(--color-danger-text)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{errors}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Errors</p>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="h-24 animate-pulse p-6" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="p-12 text-center">
          <Icon name="smart_toy" className="mx-auto size-10 text-[var(--color-text-muted)]" />
          <p className="mt-4 text-[var(--color-text-secondary)]">No agents deployed yet.</p>
          <Link
            href="/strategies"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary-text)] hover:underline"
          >
            Browse strategies
            <Icon name="arrow_forward" className="size-4" />
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => {
            const strategy = getStrategy(agent.strategyId);
            return (
              <Card key={agent.id} className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)]">
                      <Icon name={strategy?.icon ?? "smart_toy"} className="size-5 text-[var(--color-primary-text)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-white">{agent.name}</h3>
                        <Status label={agent.status} tone={STATUS_TONE[agent.status]} />
                        <Badge tone="neutral">{MODE_LABEL[agent.writerMode]}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {strategy?.name ?? agent.strategyId} &middot;{" "}
                        {agent.lastRun
                          ? `Last run ${new Date(agent.lastRun).toLocaleString()}`
                          : "Never run"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden gap-4 sm:flex">
                      <div className="text-center">
                        <p className="font-mono text-sm text-white">{agent.runs}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Runs</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm text-white">{agent.errors}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Errors</p>
                      </div>
                    </div>

                    {agent.status === "running" ? (
                      <Button
                        tone="secondary"
                        onClick={() => handleAction(agent.id, "stop")}
                      >
                        <Icon name="stop" className="size-4" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleAction(agent.id, "start")}
                      >
                        <Icon name="play_arrow" className="size-4" />
                        Start
                      </Button>
                    )}

                    <button
                      onClick={() => handleAction(agent.id, "delete")}
                      className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-text)]"
                      title="Delete agent"
                    >
                      <Icon name="delete" className="size-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
