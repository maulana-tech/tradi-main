"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useReadContract, useReadContracts, useBlockNumber } from "wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS, CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { Status, Badge } from "./ui/Badge";
import { ButtonLink } from "./ui/Button";
import { getKeeperHubAudit, type KeeperHubAuditLog } from "@/lib/hooks/useKeeperHubAudit";
import { AuditLogDrawer } from "./AuditLogDrawer";

const TOKEN_NAMES: Record<string, string> = {
  [CUSDC_ADDRESS.toLowerCase()]: "cUSDC",
  [CETH_ADDRESS.toLowerCase()]: "cETH",
};

export function ActivityFeed() {
  const [selectedAudit, setSelectedAudit] = useState<KeeperHubAuditLog | null>(null);
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { data: nextIntentId, refetch } = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "nextIntentId",
  });

  useEffect(() => {
    if (blockNumber) void refetch();
  }, [blockNumber, refetch]);

  const total = nextIntentId ? Number(nextIntentId) : 0;
  const start = Math.max(0, total - 3);
  const ids = Array.from({ length: total - start }, (_, i) => BigInt(start + i));
  const result = useReadContracts({
    contracts: ids.map((id) => ({
      address: PRIVATE_OTC_ADDRESS,
      abi: privateOtcAbi,
      functionName: "intents" as const,
      args: [id] as const,
    })),
    allowFailure: true,
    query: { enabled: ids.length > 0 },
  });

  const rows = (result.data ?? [])
    .flatMap((entry, index) => {
      if (entry.status !== "success") return [];
      const value = entry.result as readonly [
        `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`,
        bigint, number, number, `0x${string}`, `0x${string}`,
      ];
      return [{ id: ids[index], maker: value[0], sellToken: value[1], buyToken: value[2], status: value[6], mode: value[7] }];
    })
    .reverse();

  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg)]">
      <AuditLogDrawer
        isOpen={Boolean(selectedAudit)}
        onClose={() => setSelectedAudit(null)}
        audit={selectedAudit}
      />
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-[120px]">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-[var(--color-primary-text)]">Live activity</p>
            <h2 className="mt-4 text-headline-xl">Proof that the market is moving.</h2>
            <p className="mt-5 text-lg leading-8 text-pretty text-[var(--color-text-secondary)]">The latest intents read directly from the testnet contract with KeeperHub audit logs.</p>
          </div>
          <Link href={"/intents" as Route} className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-white hover:text-[var(--color-primary-text)]">
            View marketplace <Icon name="arrow_forward" className="size-4" />
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="mt-10">
            <EmptyState icon="inbox" title="No live intents yet" body="Create the first encrypted intent on this deployment." action={<ButtonLink href="/create">Create a trade</ButtonLink>} />
          </div>
        ) : (
          <ul className="mt-16 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {rows.map((row) => {
              const audit = getKeeperHubAudit(row.id);
              return (
                <li key={row.id.toString()} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-5 hover:bg-[var(--color-surface-low)] px-3 rounded transition">
                  <Link
                    href={(row.mode === 1 ? `/rfq/${row.id}` : `/intents/${row.id}`) as Route}
                    className="flex-1 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center hover:text-[var(--color-primary-text)]"
                  >
                    <div>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-text-muted)]">Intent #{row.id.toString()}</span>
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{row.mode === 1 ? "Sealed RFQ" : "Direct OTC"}</p>
                    </div>
                    <div>
                      <p className="font-display text-xl font-medium text-white">
                        {TOKEN_NAMES[row.sellToken.toLowerCase()] ?? shortAddress(row.sellToken)} <span className="text-[var(--color-text-muted)]">→</span> {TOKEN_NAMES[row.buyToken.toLowerCase()] ?? shortAddress(row.buyToken)}
                      </p>
                      <span className="mt-2 block font-mono text-xs text-[var(--color-text-muted)]">Maker {shortAddress(row.maker)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Status label={row.status === 0 ? "Open" : row.status === 1 ? "Filled" : row.status === 2 ? "Cancelled" : "Expired"} tone={row.status === 0 ? "success" : "neutral"} />
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      onClick={() => setSelectedAudit(audit)}
                      className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-primary-text)] hover:border-[var(--color-primary-text)] transition"
                    >
                      <Icon name="shield" className="size-3.5" />
                      <span>{audit.routedVia}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
