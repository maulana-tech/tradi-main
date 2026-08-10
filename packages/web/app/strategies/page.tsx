"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { StarRating } from "@/components/StarRating";
import { STRATEGIES, type StrategyCategory } from "@/lib/strategies";

const CATEGORIES: { value: StrategyCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "otc", label: "OTC" },
  { value: "market-making", label: "Market Making" },
  { value: "arbitrage", label: "Arbitrage" },
  { value: "liquidation", label: "Liquidation" },
  { value: "defi", label: "DeFi" },
];

const RISK_TONE = { low: "success" as const, medium: "warning" as const, high: "danger" as const };

export default function StrategiesPage() {
  const [category, setCategory] = useState<StrategyCategory | "all">("all");

  const filtered =
    category === "all" ? STRATEGIES : STRATEGIES.filter((s) => s.category === category);

  return (
    <AppShell>
      <PageHeader
        icon="storefront"
        title="Strategy Marketplace"
        subtitle="Browse and deploy automated trading strategies. Each strategy runs as an agent powered by Hermes AI and KeeperHub execution."
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              category === cat.value
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((strategy) => (
          <Link
            key={strategy.id}
            href={`/strategies/${strategy.id}` as Route}
            className="group"
          >
            <Card className="h-full p-6 transition-all duration-200 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-raised)]">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)]">
                  <Icon name={strategy.icon} className="size-5 text-[var(--color-primary-text)]" />
                </div>
                <Badge tone={RISK_TONE[strategy.risk]}>
                  {strategy.risk} risk
                </Badge>
              </div>

              <h3 className="mt-4 font-display text-lg font-semibold text-white group-hover:text-[var(--color-primary-text)]">
                {strategy.name}
              </h3>

              <StarRating strategyId={strategy.id} interactive size="sm" />

              <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
                {strategy.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {strategy.features.slice(0, 3).map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-[var(--color-surface-low)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                  >
                    {f}
                  </span>
                ))}
                {strategy.features.length > 3 && (
                  <span className="rounded-full bg-[var(--color-surface-low)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                    +{strategy.features.length - 3} more
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                <div className="flex gap-1.5">
                  {strategy.chains.map((chain) => (
                    <span key={chain} className="text-xs text-[var(--color-text-muted)]">
                      {chain}
                    </span>
                  ))}
                </div>
                <Icon name="arrow_forward" className="size-4 text-[var(--color-text-muted)] transition group-hover:text-[var(--color-primary-text)]" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <Icon name="search_off" className="mx-auto size-10 text-[var(--color-text-muted)]" />
          <p className="mt-4 text-[var(--color-text-secondary)]">No strategies in this category yet.</p>
        </div>
      )}
    </AppShell>
  );
}
