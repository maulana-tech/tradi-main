"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { useTradeHistory, tokenName, type TradeRow } from "@/lib/hooks/useTradeHistory";
import { shortAddress } from "@/lib/utils";

type StatusFilter = "all" | "open" | "filled" | "cancelled";
type PairFilter = "all" | "ceth-cusdc" | "cusdc-ceth";

export default function HistoryPage() {
  const { rows, isLoading } = useTradeHistory();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pairFilter, setPairFilter] = useState<PairFilter>("all");
  const filtered = rows.filter((row) => {
    const targetStatus = { all: -1, open: 0, filled: 1, cancelled: 2 }[statusFilter];
    if (targetStatus >= 0 && row.status !== targetStatus) return false;
    const rowPair = `${tokenName(row.sellToken)}-${tokenName(row.buyToken)}`.toLowerCase();
    return pairFilter === "all" || rowPair === pairFilter;
  });

  return (
    <AppShell>
      <PageHeader icon="history" title="Activity" subtitle="Follow every intent from creation through settlement." />
      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Filter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[['all','All statuses'],['open','Open'],['filled','Filled'],['cancelled','Cancelled']]} />
          <Filter label="Pair" value={pairFilter} onChange={(value) => setPairFilter(value as PairFilter)} options={[['all','All pairs'],['ceth-cusdc','cETH → cUSDC'],['cusdc-ceth','cUSDC → cETH']]} />
          <p className="min-h-11 content-center text-sm text-[var(--color-text-muted)]" aria-live="polite">{filtered.length} trade{filtered.length === 1 ? "" : "s"}</p>
        </div>
      </Card>

      {isLoading ? <HistorySkeleton /> : filtered.length === 0 ? (
        <EmptyState icon="history" title="No activity yet" body="Trades appear here as soon as intents are created on-chain." />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-low)] text-xs text-[var(--color-text-muted)]"><tr><Th>ID</Th><Th>Pair</Th><Th>Mode</Th><Th>Status</Th><Th>Maker</Th><Th>Taker</Th><Th>Created</Th></tr></thead>
              <tbody className="divide-y divide-[var(--color-border)]">{filtered.map((row) => <HistoryRow key={row.id.toString()} row={row} />)}</tbody>
            </table>
          </div>
          <ul className="divide-y divide-[var(--color-border)] md:hidden">{filtered.map((row) => <HistoryCard key={row.id.toString()} row={row} />)}</ul>
        </Card>
      )}
    </AppShell>
  );
}

function HistoryRow({ row }: { row: TradeRow }) {
  return (
    <tr className="transition-colors duration-150 hover:bg-[var(--color-surface-low)]">
      <Td mono>#{row.id.toString()}</Td><Td>{pairLabel(row)}</Td><Td><Badge tone={row.mode === 1 ? "primary" : "neutral"}>{row.mode === 1 ? "Sealed RFQ" : "Direct"}</Badge></Td><Td><RowStatus status={row.status} /></Td><Td mono>{shortAddress(row.maker)}</Td><Td mono>{row.taker === "—" ? "—" : shortAddress(row.taker)}</Td><Td>{formatDate(row.createdAt)}</Td>
    </tr>
  );
}

function HistoryCard({ row }: { row: TradeRow }) {
  return (
    <li className="p-5">
      <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs tabular-nums text-[var(--color-text-muted)]">Intent #{row.id.toString()}</span><RowStatus status={row.status} /></div>
      <p className="mt-5 font-display text-xl font-medium text-white">{pairLabel(row)}</p>
      <div className="mt-4 flex items-center justify-between gap-3"><Badge tone={row.mode === 1 ? "primary" : "neutral"}>{row.mode === 1 ? "Sealed RFQ" : "Direct"}</Badge><span className="text-xs text-[var(--color-text-muted)]">{formatDate(row.createdAt)}</span></div>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4"><Address label="Maker" value={row.maker} /><Address label="Taker" value={row.taker} /></dl>
    </li>
  );
}

function RowStatus({ status }: { status: number }) {
  const label = status === 0 ? "Open" : status === 1 ? "Filled" : status === 2 ? "Cancelled" : status === 4 ? "Pending" : "Expired";
  const tone = status === 0 ? "success" : status === 2 ? "danger" : status === 4 ? "warning" : "neutral";
  return <Status label={label} tone={tone} />;
}

function Address({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[var(--color-text-muted)]">{label}</dt><dd className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">{value === "—" ? "—" : shortAddress(value)}</dd></div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string,string][] }) { return <label className="text-sm font-medium text-white">{label}<select className="tradi-nox-input mt-2 min-h-11 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-medium">{children}</th>; }
function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) { return <td className={`px-4 py-3 text-sm text-[var(--color-text-secondary)] ${mono ? "font-mono text-xs" : ""}`}>{children}</td>; }
function pairLabel(row: TradeRow) { return `${tokenName(row.sellToken)} → ${tokenName(row.buyToken)}`; }
function formatDate(timestamp: number) { return timestamp > 0 ? new Date(timestamp * 1000).toLocaleDateString() : "—"; }
function HistorySkeleton() { return <Card className="overflow-hidden"><div className="space-y-4 p-5 md:hidden"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div><table className="hidden w-full md:table"><tbody><SkeletonRow /><SkeletonRow /><SkeletonRow /></tbody></table></Card>; }
