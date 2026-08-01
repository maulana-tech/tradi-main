"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

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
    <div className="grid grid-cols-1 gap-8 p-8 md:grid-cols-3">
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
    </div>
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
    <div className="space-y-2 text-left">
      <div className="text-label-caps text-[--color-text-muted]">{label}</div>
      <div className="flex h-10 items-center bg-[--color-primary]/5 px-4">
        {sealed ? (
          <div className="flex gap-1" aria-label="encrypted amount">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-5 w-3 bg-[--color-primary]/20"
              />
            ))}
          </div>
        ) : (
          <span
            className={`truncate font-mono text-xs ${
              tone === "primary" ? "text-[--color-primary]" : "text-[--color-text]"
            }`}
            title={value}
          >
            {value ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
}
