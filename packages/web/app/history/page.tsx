"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRow } from "@/components/Skeleton";
import { useTradeHistory, tokenName, type TradeRow } from "@/lib/hooks/useTradeHistory";
import { shortAddress } from "@/lib/utils";

type StatusFilter = "all" | "open" | "filled" | "cancelled";
type PairFilter = "all" | "ceth-cusdc" | "cusdc-ceth";

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Open", color: "text-[--color-primary]" },
  1: { label: "Filled", color: "text-[--color-text-muted]" },
  2: { label: "Cancelled", color: "text-[--color-danger]" },
  3: { label: "Expired", color: "text-[--color-text-muted]" },
  4: { label: "Pending", color: "text-[--color-warning]" },
};

export default function HistoryPage() {
  const { rows, isLoading } = useTradeHistory();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pairFilter, setPairFilter] = useState<PairFilter>("all");

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all") {
      const map: Record<StatusFilter, number> = { all: -1, open: 0, filled: 1, cancelled: 2 };
      if (r.status !== map[statusFilter]) return false;
    }
    if (pairFilter !== "all") {
      const pair = `${tokenName(r.sellToken)}→${tokenName(r.buyToken)}`;
      if (pairFilter === "ceth-cusdc" && !pair.includes("cETH")) return false;
      if (pairFilter === "cusdc-ceth" && !pair.includes("cUSDC")) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        icon="history"
        title="Trade History"
        subtitle="All on-chain intents with timestamps"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="tradi-nox-input w-auto text-xs"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="filled">Filled</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value as PairFilter)}
          className="tradi-nox-input w-auto text-xs"
        >
          <option value="all">All Pairs</option>
          <option value="ceth-cusdc">cETH → cUSDC</option>
          <option value="cusdc-ceth">cUSDC → cETH</option>
        </select>
        <span className="ml-auto self-center text-xs text-[--color-text-muted]">
          {filtered.length} trades
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <table className="w-full">
            <tbody className="divide-y divide-[--color-border]/50">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="history"
            title="No trades yet"
            body="Trades will appear here once intents are settled on-chain."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[--color-border] bg-[--color-surface-low]/30 text-left text-xs text-[--color-text-muted]">
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">Pair</th>
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Maker</th>
                <th className="px-4 py-2.5 font-medium">Taker</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]/50">
              {filtered.map((row) => (
                <HistoryRow key={row.id.toString()} row={row} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function HistoryRow({ row }: { row: TradeRow }) {
  const status = STATUS_LABELS[row.status] ?? STATUS_LABELS[0];
  const pair = `${tokenName(row.sellToken)}→${tokenName(row.buyToken)}`;
  const mode = row.mode === 0 ? "Limit" : "RFQ";

  return (
    <tr className="text-sm transition-colors hover:bg-[--color-surface-low]/30">
      <td className="px-4 py-2.5 font-mono text-xs text-[--color-text-muted]">
        #{row.id.toString().padStart(4, "0")}
      </td>
      <td className="px-4 py-2.5 font-medium text-[--color-foreground]">{pair}</td>
      <td className="px-4 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          row.mode === 0
            ? "bg-orange-50 text-orange-700"
            : "bg-[--color-primary]/10 text-[--color-primary]"
        }`}>
          {mode}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-[--color-text-secondary]">
        {shortAddress(row.maker, 4)}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-[--color-text-secondary]">
        {row.taker === "—" ? "—" : shortAddress(row.taker, 4)}
      </td>
      <td className="px-4 py-2.5 text-xs text-[--color-text-muted]">
        {row.createdAt > 0 ? new Date(row.createdAt * 1000).toLocaleDateString() : "—"}
      </td>
    </tr>
  );
}
