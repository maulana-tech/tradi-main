"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  useReadContract,
  useReadContracts,
  useBlockNumber,
} from "wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS, CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";

const TOKEN_NAMES: Record<string, string> = {
  [CUSDC_ADDRESS.toLowerCase()]: "cUSDC",
  [CETH_ADDRESS.toLowerCase()]: "cETH",
};

export function ActivityFeed() {
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const next = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "nextIntentId",
  });

  useEffect(() => {
    if (blockNumber) next.refetch();
  }, [blockNumber, next]);

  const total = next.data ? Number(next.data) : 0;
  const start = Math.max(0, total - 3);
  const ids = Array.from({ length: total - start }, (_, i) =>
    BigInt(start + i),
  );

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
    .map((r, i) => {
      if (r.status !== "success") return null;
      const v = r.result as readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        number,
        number,
        `0x${string}`,
        `0x${string}`,
      ];
      return {
        id: ids[i],
        maker: v[0],
        sellToken: v[1],
        buyToken: v[2],
        deadline: v[5],
        status: v[6],
        mode: v[7],
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .reverse();

  return (
    <section className="bg-[--color-surface]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-8">
          <h2 className="text-headline-lg text-[--color-foreground]">
            Recent activity
          </h2>
          <p className="mt-1 text-sm text-[--color-text-secondary]">
            Latest on-chain intents
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[--color-border] bg-[--color-bg] p-10 text-center">
            <span className="material-symbols-outlined mb-2 text-3xl text-[--color-text-muted]">
              inbox
            </span>
            <p className="text-sm text-[--color-text-muted]">
              No intents yet — be the first
            </p>
            <Link
              href={"/create" as Route}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[--color-primary] hover:underline"
            >
              Create intent
              <span className="material-symbols-outlined text-base">
                arrow_forward
              </span>
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {rows.map((row) => (
              <Link
                key={row.id.toString()}
                href={
                  (row.mode === 1
                    ? `/rfq/${row.id.toString()}`
                    : `/intents/${row.id.toString()}`) as Route
                }
                className="group rounded-lg border border-[--color-border] bg-[--color-surface] p-4 transition-all hover:border-[--color-primary]/30 hover:shadow-sm"
              >
                <li>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-[--color-text-muted]">
                      #{row.id.toString().padStart(4, "0")}
                    </span>
                    <ModeBadge mode={row.mode} />
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[--color-text]">
                      {TOKEN_NAMES[row.sellToken.toLowerCase()] ??
                        shortAddress(row.sellToken, 4)}
                    </span>
                    <span className="text-[--color-text-muted]">→</span>
                    <span className="font-medium text-[--color-primary]">
                      {TOKEN_NAMES[row.buyToken.toLowerCase()] ??
                        shortAddress(row.buyToken, 4)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-3 text-xs text-[--color-text-muted]">
                    <span>{shortAddress(row.maker, 4)}</span>
                    <StatusDot status={row.status} />
                  </div>
                </li>
              </Link>
            ))}
          </ul>
        )}

        <div className="mt-6 text-right">
          <Link
            href={"/intents" as Route}
            className="inline-flex items-center gap-1 text-sm font-medium text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
          >
            View all
            <span className="material-symbols-outlined text-base">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ModeBadge({ mode }: { mode: number }) {
  const isRfq = mode === 1;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isRfq
          ? "bg-[--color-primary]/10 text-[--color-primary]"
          : "bg-orange-50 text-orange-700"
      }`}
    >
      {isRfq ? "RFQ" : "Direct"}
    </span>
  );
}

function StatusDot({ status }: { status: number }) {
  const cfg = {
    0: { color: "bg-[--color-primary]", label: "Open" },
    1: { color: "bg-[--color-text-muted]", label: "Filled" },
    2: { color: "bg-orange-400", label: "Cancelled" },
    3: { color: "bg-[--color-text-muted]", label: "Expired" },
  }[status as 0 | 1 | 2 | 3] ?? {
    color: "bg-[--color-border]",
    label: "Unknown",
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
      <span className="text-[--color-text-secondary]">{cfg.label}</span>
    </span>
  );
}
