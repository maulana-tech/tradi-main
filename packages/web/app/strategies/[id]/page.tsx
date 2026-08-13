"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { getStrategy } from "@/lib/strategies";
import { Button } from "@/components/ui/Button";

const RISK_TONE = { low: "success" as const, medium: "warning" as const, high: "danger" as const };

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const strategy = getStrategy(id);

  const [deploying, setDeploying] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [writerMode, setWriterMode] = useState<"agent" | "hermes" | "dry-run">("agent");
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(strategy?.config ?? {}).map(([k, v]) => [k, v.default])
    )
  );

  if (!strategy) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <Icon name="error" className="mx-auto size-10 text-[var(--color-danger-text)]" />
          <p className="mt-4 text-[var(--color-text-secondary)]">Strategy not found.</p>
          <Link href={"/strategies" as Route} className="mt-4 inline-block text-sm text-[var(--color-primary-text)] hover:underline">
            Back to marketplace
          </Link>
        </div>
      </AppShell>
    );
  }

  async function handleDeploy() {
    setDeploying(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy!.id,
          name: agentName || `${strategy!.name} Agent`,
          config: configValues,
          writerMode,
        }),
      });
      const data = (await res.json()) as { ok: boolean; agent: { id: string } };
      if (data.ok) {
        router.push("/dashboard" as Route);
      }
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        icon={strategy.icon}
        title={strategy.name}
        subtitle={strategy.description}
        badge={<Badge tone={RISK_TONE[strategy.risk]}>{strategy.risk} risk</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">Features</h3>
            <ul className="space-y-2">
              {strategy.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Icon name="check_circle" className="size-4 text-[var(--color-success-text)]" />
                  {f}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">MCP Tools Used</h3>
            <div className="flex flex-wrap gap-2">
              {strategy.mcpTools.map((tool) => (
                <code key={tool} className="rounded bg-[var(--color-surface-low)] px-2 py-1 font-mono text-xs text-[var(--color-primary-text)]">
                  {tool}
                </code>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">Configuration</h3>
            <div className="space-y-4">
              {Object.entries(strategy.config).map(([key, field]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)]">
                    {field.label}
                  </label>
                  <p className="mb-1 text-xs text-[var(--color-text-muted)]">{field.description}</p>
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    value={configValues[key] ?? ""}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-low)] px-3 py-2 font-mono text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-foreground)]">Deploy Agent</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)]">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder={`${strategy.name} Agent`}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-low)] px-3 py-2 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)]">Writer Mode</label>
                <select
                  value={writerMode}
                  onChange={(e) => setWriterMode(e.target.value as typeof writerMode)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-low)] px-3 py-2 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                >
                  <option value="agent">Agent (auto-execute)</option>
                  <option value="hermes">Hermes (AI decides)</option>
                  <option value="dry-run">Dry Run (log only)</option>
                </select>
              </div>

              <Button
                onClick={handleDeploy}
                disabled={deploying}
                className="w-full"
              >
                {deploying ? "Deploying..." : "Deploy Agent"}
              </Button>

              <p className="text-xs text-[var(--color-text-muted)]">
                The agent will run continuously, executing this strategy according to its configuration.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">Supported Chains</h3>
            <div className="space-y-2">
              {strategy.chains.map((chain) => (
                <div key={chain} className="flex items-center gap-2">
                  <Icon name="link" className="size-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-secondary)]">{chain}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
