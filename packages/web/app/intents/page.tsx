"use client";

import Link from "next/link";
import type { Route } from "next";
import { Suspense, useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { SkeletonRow } from "@/components/Skeleton";
import { useIntents, statusLabel } from "@/lib/hooks/useIntents";
import { shortAddress } from "@/lib/utils";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";

const TOKEN_NAMES: Record<string, string> = {
  [CUSDC_ADDRESS.toLowerCase()]: "cUSDC",
  [CETH_ADDRESS.toLowerCase()]: "cETH",
};

type ModeFilter = "all" | "direct" | "rfq";
type StatusFilter = "all" | "open" | "filled" | "cancelled" | "pending";
type PairFilter = "all" | "ceth-cusdc" | "cusdc-ceth";

const PAGE_SIZE = 10;

const MODE_VALUES: ModeFilter[] = ["all", "direct", "rfq"];
const STATUS_VALUES: StatusFilter[] = [
  "all",
  "open",
  "pending",
  "filled",
  "cancelled",
];
const PAIR_VALUES: PairFilter[] = ["all", "ceth-cusdc", "cusdc-ceth"];

function parseEnum<T extends string>(
  raw: string | null,
  values: T[],
  fallback: T,
): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
}

// Wrapper: useSearchParams() requires a Suspense boundary so Next.js can
// stream the rest of the page during prerender while waiting for the
// search params to resolve on the client.
export default function IntentsPage() {
  return (
    <Suspense fallback={<IntentsLoadingSkeleton />}>
      <IntentsPageContent />
    </Suspense>
  );
}

function IntentsLoadingSkeleton() {
  return (
    <AppShell>
      <PageHeader
        icon="grid_view"
        title="Order Book"
        subtitle="Browse active intents with encrypted amounts"
      />
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[--color-border] p-4">
          <div className="flex items-center gap-2 text-xs text-[--color-text-muted]">
            <span className="material-symbols-outlined animate-spin text-base text-[--color-primary]">
              sync
            </span>
            Loading intents…
          </div>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-[--color-border]/50">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function IntentsPageContent() {
  const { address } = useAccount();
  const { rows, isLoading, error } = useIntents(60);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL so /intents?mode=rfq&status=filled&p=2 is shareable.
  const [modeFilter, setModeFilter] = useState<ModeFilter>(() =>
    parseEnum(searchParams.get("mode"), MODE_VALUES, "all"),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseEnum(searchParams.get("status"), STATUS_VALUES, "all"),
  );
  const [pairFilter, setPairFilter] = useState<PairFilter>(() =>
    parseEnum(searchParams.get("pair"), PAIR_VALUES, "all"),
  );
  const [onlyMine, setOnlyMine] = useState(
    () => searchParams.get("mine") === "1",
  );
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get("p") ?? "1");
    return Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
  });

  // Reset to page 1 whenever a filter changes — staying on page 5 after
  // narrowing the result set to 3 rows would render an empty table.
  useEffect(() => {
    setPage(1);
  }, [modeFilter, statusFilter, pairFilter, onlyMine]);

  // Reflect filter + page state back into the URL so links survive page
  // reload and browser back/forward keeps the same view. router.replace
  // avoids pushing a new history entry per filter / pagination click.
  useEffect(() => {
    const params = new URLSearchParams();
    if (modeFilter !== "all") params.set("mode", modeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (pairFilter !== "all") params.set("pair", pairFilter);
    if (onlyMine) params.set("mine", "1");
    if (page !== 1) params.set("p", String(page));
    const qs = params.toString();
    router.replace(qs ? `/intents?${qs}` : "/intents", { scroll: false });
  }, [modeFilter, statusFilter, pairFilter, onlyMine, page, router]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (modeFilter === "direct" && r.mode !== 0) return false;
      if (modeFilter === "rfq" && r.mode !== 1) return false;

      if (statusFilter === "open" && r.status !== 0) return false;
      if (statusFilter === "filled" && r.status !== 1) return false;
      if (statusFilter === "cancelled" && r.status !== 2) return false;
      if (statusFilter === "pending" && r.status !== 4) return false;

      if (pairFilter !== "all") {
        const sell = TOKEN_NAMES[r.sellToken.toLowerCase()] ?? "?";
        const buy = TOKEN_NAMES[r.buyToken.toLowerCase()] ?? "?";
        const pairKey = `${sell}-${buy}`.toLowerCase();
        if (pairFilter === "ceth-cusdc" && pairKey !== "ceth-cusdc")
          return false;
        if (pairFilter === "cusdc-ceth" && pairKey !== "cusdc-ceth")
          return false;
      }

      if (
        onlyMine &&
        address &&
        r.maker.toLowerCase() !== address.toLowerCase()
      ) {
        return false;
      }

      return true;
    });
  }, [rows, modeFilter, statusFilter, pairFilter, onlyMine, address]);

  const clearFilters = () => {
    setModeFilter("all");
    setStatusFilter("all");
    setPairFilter("all");
    setOnlyMine(false);
  };

  const activeFilterCount =
    (modeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (pairFilter !== "all" ? 1 : 0) +
    (onlyMine ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp without setState in render — handled by useEffect that resets
  // on filter change. Any stale page index just produces an empty slice.
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <AppShell>
      <PageHeader
        icon="grid_view"
        title="Order Book"
        subtitle="Browse active intents with encrypted amounts"
        action={
          <Link href={"/create" as Route}>
            <button className="tradi-nox-btn-primary flex items-center gap-2 px-5 py-2 text-xs">
              <span className="material-symbols-outlined text-base">add</span>
              New Intent
            </button>
          </Link>
        }
      />

      {!isLoading && rows.length > 0 && (
        <FilterBar
          modeFilter={modeFilter}
          setModeFilter={setModeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          pairFilter={pairFilter}
          setPairFilter={setPairFilter}
          onlyMine={onlyMine}
          setOnlyMine={setOnlyMine}
          walletConnected={!!address}
          totalCount={rows.length}
          filteredCount={filtered.length}
          activeFilterCount={activeFilterCount}
          onClear={clearFilters}
        />
      )}

      {isLoading && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[--color-border] p-4">
            <div className="flex items-center gap-2 font-mono text-xs text-[--color-text-muted]">
              <span className="material-symbols-outlined animate-spin text-base text-[--color-primary]">
                sync
              </span>
              FETCHING ON-CHAIN INTENTS
            </div>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-[--color-border]/50">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 border border-[--color-danger] bg-[--color-danger]/10 p-3 font-mono text-sm text-[--color-danger]">
          <span className="material-symbols-outlined text-base">error</span>
          {error.message}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          icon="inbox"
          title="NO ACTIVE INTENTS"
          body="No one has opened a trade yet on this network"
          action={
            <Link href={"/create" as Route}>
              <button className="tradi-nox-btn-primary flex items-center gap-2 px-5 py-2 text-xs">
                <span className="material-symbols-outlined text-base">
                  add
                </span>
                Open the first one
              </button>
            </Link>
          }
        />
      )}

      {rows.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon="filter_alt_off"
          title="NO INTENTS MATCH THESE FILTERS"
          body="Try clearing one of the filters to see more results"
          action={
            <button
              onClick={clearFilters}
              className="tradi-nox-btn-primary flex items-center gap-2 px-5 py-2 text-xs"
            >
              <span className="material-symbols-outlined text-base">
                refresh
              </span>
              Clear filters
            </button>
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="glass-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
            <SectionHeader icon="menu_book" title="Order Book" />
            <div className="hidden gap-3 lg:flex">
              <Legend color="bg-emerald-400" label="Open" />
              <Legend color="bg-amber-400" label="Pending" />
              <Legend color="bg-gray-400" label="Filled" />
              <Legend color="bg-orange-500" label="Cancelled" />
            </div>
          </div>

          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[80px]" />
              <col className="w-auto" />
              <col className="w-[88px]" />
              <col className="w-[112px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[80px]" />
              <col className="w-[88px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[--color-border] bg-[--color-surface-low]/50">
                <Th>Intent ID</Th>
                <Th>Sell → Buy</Th>
                <Th>Mode</Th>
                <Th>Maker</Th>
                <Th>Volume</Th>
                <Th>Status</Th>
                <Th>Expires</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]/50">
              {pageRows.map((row) => (
                <tr
                  key={row.id.toString()}
                  className="group transition-colors hover:bg-[--color-surface-low]/20"
                >
                  <Td>
                    <span
                      className="font-mono text-xs text-[--color-text]"
                      title={`Intent #${row.id.toString()}`}
                    >
                      #{row.id.toString().padStart(4, "0")}
                    </span>
                  </Td>

                  <Td>
                    <PairCell
                      sell={
                        TOKEN_NAMES[row.sellToken.toLowerCase()] ?? "?"
                      }
                      buy={TOKEN_NAMES[row.buyToken.toLowerCase()] ?? "?"}
                    />
                  </Td>

                  <Td>
                    <ModeBadge mode={row.mode} />
                  </Td>

                  <Td>
                    <span
                      className="flex items-center gap-1 font-mono text-[11px] text-[--color-text-muted]"
                      title={row.maker}
                    >
                      <span className="truncate">
                        {shortAddress(row.maker, 4)}
                      </span>
                      {address &&
                        row.maker.toLowerCase() ===
                          address.toLowerCase() && (
                          <span className="text-label-caps shrink-0 border border-[--color-primary]/40 bg-[--color-primary]/10 px-1 py-0 text-[8px] text-[--color-primary]">
                            YOU
                          </span>
                        )}
                    </span>
                  </Td>

                  <Td>
                    <span
                      className="flex items-center gap-1 border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 font-mono text-[10px] text-[--color-text-muted]"
                      title={row.sellAmountHandle}
                    >
                      <span className="material-symbols-outlined shrink-0 text-sm text-[--color-primary]/40">
                        lock
                      </span>
                      <span className="truncate">
                        {row.sellAmountHandle.slice(0, 8)}…
                      </span>
                    </span>
                  </Td>

                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>

                  <Td>
                    <RelativeTime ts={row.deadline} status={row.status} />
                  </Td>

                  <Td align="right">
                    {row.status === 0 && (
                      <Link
                        href={
                          (row.mode === 1
                            ? `/rfq/${row.id.toString()}`
                            : `/intents/${row.id.toString()}`) as Route
                        }
                        className="text-label-caps inline-flex items-center border border-[--color-border] bg-[--color-surface-low] px-2 py-1 text-[--color-primary] transition-all hover:bg-[--color-primary] hover:text-[--color-primary-fg]"
                      >
                        {row.mode === 1 ? "Bid" : "Accept"}
                      </Link>
                    )}
                    {row.status !== 0 && (
                      <Link
                        href={
                          (row.mode === 1
                            ? `/rfq/${row.id.toString()}`
                            : `/intents/${row.id.toString()}`) as Route
                        }
                        className="text-label-caps text-[--color-text-muted] hover:text-[--color-text]"
                      >
                        View
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-[--color-border] bg-[--color-surface-low]/30 px-4 py-2">
            <span className="font-mono text-[10px] text-[--color-text-muted]">
              {filtered.length === 0
                ? "0 OF 0"
                : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                    safePage * PAGE_SIZE,
                    filtered.length,
                  )} OF ${filtered.length}`}
              {activeFilterCount > 0 ? " · FILTERED" : ""}
            </span>

            {totalPages > 1 ? (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onChange={setPage}
              />
            ) : (
              <div className="text-[10px] text-[--color-text-muted]">
                Encrypted via Nox
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        aria-label="Previous page"
        className="text-label-caps flex items-center gap-1 border border-[--color-border] bg-[--color-bg] px-2 py-1 text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[--color-border] disabled:hover:text-[--color-text-muted]"
      >
        <span className="material-symbols-outlined text-sm">chevron_left</span>
        Prev
      </button>
      <span
        className="text-[10px] text-[--color-text-muted]"
        aria-live="polite"
      >
        Page {page} <span className="text-[--color-text-muted]">/ {totalPages}</span>
      </span>
      <button
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        aria-label="Next page"
        className="text-label-caps flex items-center gap-1 border border-[--color-border] bg-[--color-bg] px-2 py-1 text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[--color-border] disabled:hover:text-[--color-text-muted]"
      >
        Next
        <span className="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    </div>
  );
}

function FilterBar({
  modeFilter,
  setModeFilter,
  statusFilter,
  setStatusFilter,
  pairFilter,
  setPairFilter,
  onlyMine,
  setOnlyMine,
  walletConnected,
  totalCount,
  filteredCount,
  activeFilterCount,
  onClear,
}: {
  modeFilter: ModeFilter;
  setModeFilter: (v: ModeFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  pairFilter: PairFilter;
  setPairFilter: (v: PairFilter) => void;
  onlyMine: boolean;
  setOnlyMine: (v: boolean) => void;
  walletConnected: boolean;
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
  onClear: () => void;
}) {
  return (
    <div className="glass-card mb-4 flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="text-label-caps flex items-center gap-1 text-[--color-text-muted]">
        <span className="material-symbols-outlined text-sm">filter_alt</span>
        Filter
        {activeFilterCount > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center bg-[--color-primary] px-1 text-[9px] font-bold text-[--color-primary-fg]">
            {activeFilterCount}
          </span>
        )}
      </span>

      <FilterGroup
        options={[
          { value: "all", label: "All Modes" },
          { value: "direct", label: "Direct" },
          { value: "rfq", label: "RFQ" },
        ]}
        value={modeFilter}
        onChange={setModeFilter}
      />

      <FilterGroup
        options={[
          { value: "all", label: "All Status" },
          { value: "open", label: "Open" },
          { value: "pending", label: "Pending" },
          { value: "filled", label: "Filled" },
          { value: "cancelled", label: "Cancelled" },
        ]}
        value={statusFilter}
        onChange={setStatusFilter}
      />

      <FilterGroup
        options={[
          { value: "all", label: "All Pairs" },
          { value: "ceth-cusdc", label: "cETH→cUSDC" },
          { value: "cusdc-ceth", label: "cUSDC→cETH" },
        ]}
        value={pairFilter}
        onChange={setPairFilter}
      />

      {walletConnected && (
        <button
          onClick={() => setOnlyMine(!onlyMine)}
          className={`text-label-caps flex items-center gap-1 border px-2.5 py-1 transition-colors ${
            onlyMine
              ? "border-[--color-primary] bg-[--color-primary]/10 text-[--color-primary]"
              : "border-[--color-border] bg-[--color-bg] text-[--color-text-muted] hover:border-[--color-primary]/40 hover:text-[--color-text]"
          }`}
        >
          <span className="material-symbols-outlined text-sm">
            {onlyMine ? "check_box" : "check_box_outline_blank"}
          </span>
          Mine
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[10px] text-[--color-text-muted]">
          {filteredCount}
          <span className="text-[--color-text-muted]">/{totalCount}</span>
        </span>
        {activeFilterCount > 0 && (
          <button
            onClick={onClear}
            className="text-label-caps flex items-center gap-1 border border-[--color-border] px-2 py-1 text-[--color-text-muted] transition-colors hover:border-[--color-danger] hover:text-[--color-danger]"
            title="Clear all filters"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-[--color-border] bg-[--color-bg]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-label-caps px-2.5 py-1 transition-colors ${
            value === opt.value
              ? "bg-[--color-primary] text-[--color-primary-fg]"
              : "text-[--color-text-muted] hover:bg-[--color-surface-low] hover:text-[--color-text]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PairCell({ sell, buy }: { sell: string; buy: string }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div
        className="flex items-center gap-1"
        title={`Maker is selling ${sell}`}
      >
        <span className="text-[8px] font-bold uppercase tracking-wider text-rose-400/80">
          S
        </span>
        <TokenIcon symbol={sell} size="sm" />
        <span className="font-mono text-xs text-[--color-text]">{sell}</span>
      </div>
      <span className="material-symbols-outlined text-base text-[--color-text-muted]">
        arrow_forward
      </span>
      <div
        className="flex items-center gap-1"
        title={`Maker wants to receive ${buy}`}
      >
        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/80">
          B
        </span>
        <TokenIcon symbol={buy} size="sm" />
        <span className="font-mono text-xs text-[--color-text]">{buy}</span>
      </div>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`text-label-caps px-3 py-3 text-[--color-text-muted] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      className={`px-3 py-3 text-sm ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </td>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="font-mono text-[9px] uppercase text-[--color-text-muted]">
        {label}
      </span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: number }) {
  const cls =
    mode === 0
      ? "border-orange-900 bg-orange-950/40 text-orange-400"
      : "border-emerald-900 bg-emerald-950/40 text-emerald-400";
  return (
    <span
      className={`text-label-caps inline-block border px-1.5 py-0.5 text-[10px] ${cls}`}
      title={mode === 0 ? "Direct OTC — bilateral 1:1" : "Vickrey RFQ auction"}
    >
      {mode === 0 ? "Direct" : "RFQ"}
    </span>
  );
}

function StatusBadge({ status }: { status: number }) {
  const map: Record<number, string> = {
    0: "border-emerald-900 bg-emerald-950/40 text-emerald-400",
    1: "border-[--color-border] bg-[--color-surface-low]/40 text-[--color-text-muted]",
    2: "border-orange-900 bg-orange-950/40 text-orange-400",
    3: "border-[--color-border] bg-[--color-surface-low]/40 text-[--color-text-muted]",
    4: "border-amber-700 bg-amber-950/40 text-amber-400 animate-pulse",
  };
  return (
    <span
      className={`text-label-caps border px-2 py-0.5 text-[10px] ${
        map[status] ?? "border-[--color-border] bg-[--color-surface-low]/40 text-[--color-text-muted]"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

// Color-coded urgency: red <1h, orange <24h, amber <3d, neutral otherwise.
// Hover shows the absolute deadline. Past deadlines render muted "expired".
function RelativeTime({ ts, status }: { ts: bigint; status: number }) {
  const seconds = Number(ts) - Math.floor(Date.now() / 1000);
  const absolute = new Date(Number(ts) * 1000).toLocaleString();

  if (status === 1 || status === 2) {
    // Filled or Cancelled — deadline irrelevant
    return (
      <span
        className="font-mono text-[11px] text-[--color-text-muted]"
        title={`Originally expired ${absolute}`}
      >
        —
      </span>
    );
  }

  if (seconds <= 0) {
    return (
      <span
        className="font-mono text-[11px] text-[--color-text-muted]"
        title={`Expired ${absolute}`}
      >
        expired
      </span>
    );
  }

  let cls = "text-[--color-text]";
  let unit: string;
  if (seconds < 3600) {
    cls = "text-rose-400 font-semibold";
    unit = `${Math.max(1, Math.floor(seconds / 60))}m`;
  } else if (seconds < 86400) {
    cls = "text-orange-400";
    unit = `${Math.floor(seconds / 3600)}h`;
  } else if (seconds < 3 * 86400) {
    cls = "text-amber-300";
    unit = `${Math.floor(seconds / 86400)}d`;
  } else {
    cls = "text-emerald-300/80";
    unit = `${Math.floor(seconds / 86400)}d`;
  }

  return (
    <span
      className={`font-mono text-xs ${cls}`}
      title={`Closes ${absolute}`}
    >
      {unit}
    </span>
  );
}
