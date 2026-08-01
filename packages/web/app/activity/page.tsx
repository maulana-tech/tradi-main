"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { SkeletonRow } from "@/components/Skeleton";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS, CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { useIntents, statusLabel, modeLabel } from "@/lib/hooks/useIntents";
import { shortAddress } from "@/lib/utils";

// Bid struct getter — used to scan all RFQs for the user's submissions.
const RFQ_BIDS_ABI = [
  {
    type: "function",
    name: "bids",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [
      { name: "taker", type: "address" },
      { name: "offeredAmount", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

const TOKEN_NAMES: Record<string, { symbol: string; decimals: number }> = {
  [CUSDC_ADDRESS.toLowerCase()]: { symbol: "cUSDC", decimals: 6 },
  [CETH_ADDRESS.toLowerCase()]: { symbol: "cETH", decimals: 18 },
};

type Tab = "intents" | "bids" | "history";

export default function ActivityPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("intents");

  // Pull a wider window than the default 20 so older history is visible.
  const { rows, isLoading } = useIntents(50);

  // For "My Intents" — filter by maker
  const myIntents = address
    ? rows.filter((r) => r.maker.toLowerCase() === address.toLowerCase())
    : [];

  // For "History" — Settled / Cancelled status owned or counterparty'd by user
  const historyIntents = address
    ? rows.filter(
        (r) =>
          (r.status === 1 || r.status === 2) &&
          r.maker.toLowerCase() === address.toLowerCase(),
      )
    : [];

  return (
    <AppShell>
      <PageHeader
        icon="history"
        title="Activity"
        subtitle="Your intents, bids, and trade history"
      />

      {!isConnected && (
        <EmptyState
          icon="account_circle_off"
          title="Wallet not connected"
          body="Connect a wallet to view your trade activity"
        />
      )}

      {isConnected && address && (
        <>
          {/* Tab switcher */}
          <div className="mb-6 flex gap-1 border-b border-[--color-border]">
            <TabButton
              active={tab === "intents"}
              icon="description"
              label="My Intents"
              count={myIntents.length}
              onClick={() => setTab("intents")}
            />
            <TabButton
              active={tab === "bids"}
              icon="gavel"
              label="My Bids"
              count={null}
              onClick={() => setTab("bids")}
            />
            <TabButton
              active={tab === "history"}
              icon="receipt_long"
              label="History"
              count={historyIntents.length}
              onClick={() => setTab("history")}
            />
          </div>

          {/* Tab content */}
          {tab === "intents" && (
            <IntentsList
              rows={myIntents}
              isLoading={isLoading}
              emptyTitle="No intents yet"
              emptyBody="You haven't created any intents on this network"
              emptyAction={
                <Link href={"/create" as Route}>
                  <button className="tradi-nox-btn-primary flex items-center gap-2 px-5 py-2 text-xs">
                    <span className="material-symbols-outlined text-base">
                      add
                    </span>
                    Open your first intent
                  </button>
                </Link>
              }
            />
          )}

          {tab === "bids" && (
            <BidsList rfqs={rows.filter((r) => r.mode === 1)} address={address} />
          )}

          {tab === "history" && (
            <IntentsList
              rows={historyIntents}
              isLoading={isLoading}
              emptyTitle="No history yet"
              emptyBody="Your settled or cancelled intents will appear here"
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  count: number | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-label-caps flex items-center gap-2 border-b-2 px-4 py-3 transition-all ${
        active
          ? "border-[--color-primary] text-[--color-primary]"
          : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
      }`}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      <span>{label}</span>
      {count !== null && (
        <span
          className={`flex h-5 min-w-[20px] items-center justify-center px-1 text-[10px] ${
            active ? "bg-[--color-primary] text-[--color-primary-fg]" : "bg-[--color-surface-low] text-[--color-text-muted]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type IntentRow = ReturnType<typeof useIntents>["rows"][number];

function IntentsList({
  rows,
  isLoading,
  emptyTitle,
  emptyBody,
  emptyAction,
}: {
  rows: IntentRow[];
  isLoading: boolean;
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <tbody className="divide-y divide-[--color-border]/50">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title={emptyTitle}
        body={emptyBody}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[--color-border] bg-[--color-surface-low]/50">
              <Th>ID</Th>
              <Th>Pair</Th>
              <Th>Mode</Th>
              <Th>Status</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]/50">
            {rows.map((row) => {
              const sellTok = TOKEN_NAMES[row.sellToken.toLowerCase()];
              const buyTok = TOKEN_NAMES[row.buyToken.toLowerCase()];
              return (
                <tr
                  key={row.id.toString()}
                  className="group transition-colors hover:bg-[--color-surface-low]/20"
                >
                  <Td>
                    <span className="font-mono text-xs text-[--color-text-secondary]">
                      #{row.id.toString().padStart(4, "0")}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <TokenIcon symbol={sellTok?.symbol ?? "?"} size="sm" />
                      <span className="text-[--color-text-muted]">→</span>
                      <TokenIcon symbol={buyTok?.symbol ?? "?"} size="sm" />
                      <span className="ml-1 font-mono text-xs">
                        {sellTok?.symbol ?? shortAddress(row.sellToken)}/
                        {buyTok?.symbol ?? shortAddress(row.buyToken)}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-[--color-text-secondary]">
                      {modeLabel(row.mode)}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td align="right">
                    <Link
                      href={
                        row.mode === 1
                          ? (`/rfq/${row.id}` as Route)
                          : (`/intents/${row.id}` as Route)
                      }
                      className="text-label-caps text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
                    >
                      View →
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BidsList({
  rfqs,
  address,
}: {
  rfqs: IntentRow[];
  address: `0x${string}`;
}) {
  // Build a flat list of (rfqId, bidIndex) pairs to query — up to 10 per RFQ.
  const bidQueries = rfqs.flatMap((rfq) =>
    Array.from({ length: 10 }, (_, i) => ({
      address: PRIVATE_OTC_ADDRESS,
      abi: RFQ_BIDS_ABI,
      functionName: "bids" as const,
      args: [rfq.id, BigInt(i)] as const,
      meta: { rfqId: rfq.id, idx: i },
    })),
  );

  const result = useReadContracts({
    contracts: bidQueries.map(({ meta: _, ...c }) => c),
    allowFailure: true,
    query: { enabled: rfqs.length > 0 },
  });

  // Filter to bids where taker == us
  const myBids = (result.data ?? [])
    .map((r, i) => {
      if (r.status !== "success") return null;
      const v = r.result as readonly [`0x${string}`, `0x${string}`, boolean];
      const meta = bidQueries[i].meta;
      return { taker: v[0], handle: v[1], active: v[2], ...meta };
    })
    .filter(
      (b): b is NonNullable<typeof b> =>
        b !== null && b.taker.toLowerCase() === address.toLowerCase(),
    );

  if (result.isLoading) {
    return (
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <tbody className="divide-y divide-[--color-border]/50">
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    );
  }

  if (myBids.length === 0) {
    return (
      <EmptyState
        icon="gavel"
        title="No bids yet"
        body="Submit a sealed bid on an open RFQ to start participating"
        action={
          <Link href={"/intents" as Route}>
            <button className="tradi-nox-btn-primary flex items-center gap-2 px-5 py-2 text-xs">
              <span className="material-symbols-outlined text-base">
                hub
              </span>
              Browse RFQs
            </button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[--color-border] bg-[--color-surface-low]/50">
              <Th>RFQ</Th>
              <Th>Bid Slot</Th>
              <Th>Encrypted Handle</Th>
              <Th>Status</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]/50">
            {myBids.map((bid) => {
              const rfq = rfqs.find((r) => r.id === bid.rfqId);
              if (!rfq) return null;
              return (
                <tr
                  key={`${bid.rfqId}-${bid.idx}`}
                  className="transition-colors hover:bg-[--color-surface-low]/20"
                >
                  <Td>
                    <span className="font-mono text-xs text-[--color-text-secondary]">
                      #{bid.rfqId.toString().padStart(4, "0")}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-[--color-text-muted]">
                      #{(bid.idx + 1).toString().padStart(2, "0")}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="font-mono text-[10px] text-[--color-text-muted]"
                      title={bid.handle}
                    >
                      {bid.handle.slice(0, 14)}…
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={rfq.status} />
                  </Td>
                  <Td align="right">
                    <Link
                      href={`/rfq/${bid.rfqId}` as Route}
                      className="text-label-caps text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
                    >
                      View →
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`text-label-caps px-6 py-3 text-[--color-text-muted] ${
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
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      className={`px-6 py-4 ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </td>
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
