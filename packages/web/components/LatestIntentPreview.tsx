"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { cn } from "@/lib/utils";

const PRIVATE_OTC_ADDRESS = (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ??
  "0x0") as `0x${string}`;

/**
 * Hero "preview card" body — pulls the LATEST on-chain intent from
 * PrivateOTC.intents(nextIntentId - 1) so the card never displays
 * fabricated values. Maker is the actual maker address; the amount
 * field stays sealed (real handle exists on-chain but visualisation
 * intentionally hides it for the privacy narrative); the bid-proof
 * field shows the actual encrypted handle prefix.
 */
export function LatestIntentPreview() {
  const { data: nextId } = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "nextIntentId",
  });

  const total = nextId ? Number(nextId) : 0;
  const latestId = total > 0 ? BigInt(total - 1) : 0n;

  const { data: latest } = useReadContracts({
    contracts: [
      {
        address: PRIVATE_OTC_ADDRESS,
        abi: privateOtcAbi,
        functionName: "intents" as const,
        args: [latestId] as const,
      },
    ],
    allowFailure: true,
    query: { enabled: total > 0 },
  });

  const intent =
    latest?.[0]?.status === "success"
      ? (latest[0].result as readonly [
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
        ])
      : null;

  const maker = intent?.[0];
  const sellHandle = intent?.[3];

  return (
    <dl className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3 sm:p-6">
      <Field
        label="Order Origin"
        value={maker ? `${maker.slice(0, 6)}…${maker.slice(-4)}` : "—"}
        tone="primary"
      />
      <Field label="Amount (Sealed)" sealed />
      <Field
        label="Bid Proof"
        value={
          sellHandle ? `${sellHandle.slice(0, 18)}…[NOX]` : "0x[encrypted]"
        }
      />
    </dl>
  );
}

function Field({
  label,
  value,
  sealed,
  tone,
}: {
  label: string;
  value?: string;
  sealed?: boolean;
  tone?: "primary";
}) {
  return (
    <div className="min-w-0 text-left">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-3 flex min-h-8 items-center border-t border-[var(--color-border-strong)] pt-3">
        {sealed ? (
          <span className="font-mono text-sm text-[var(--color-primary-text)]" aria-label="encrypted amount">••••••</span>
        ) : (
          <span
            className={cn(
              "truncate font-mono text-xs",
              tone === "primary" ? "text-[var(--color-primary-text)]" : "text-[var(--color-text)]",
            )}
            title={value}
          >
            {value ?? "—"}
          </span>
        )}
      </dd>
    </div>
  );
}
