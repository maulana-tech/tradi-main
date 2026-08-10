"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { PRIVATE_OTC_ADDRESS, CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

const erc7984Abi = [
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export interface DashboardStats {
  totalIntents: number;
  openIntents: number;
  rfqIntents: number;
  directIntents: number;
  ethBalance: string;
  cusdcBalance: string;
  cethBalance: string;
  isLoading: boolean;
}

export function useDashboardStats(address?: `0x${string}`): DashboardStats {
  const client = usePublicClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalIntents: 0,
    openIntents: 0,
    rfqIntents: 0,
    directIntents: 0,
    ethBalance: "0",
    cusdcBalance: "0",
    cethBalance: "0",
    isLoading: true,
  });

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    async function fetch() {
      try {
        const nextId = await client!.readContract({
          address: PRIVATE_OTC_ADDRESS,
          abi: privateOtcAbi,
          functionName: "nextIntentId",
        });
        const total = Number(nextId);

        let open = 0;
        let rfq = 0;
        let direct = 0;

        if (total > 0) {
          const batch = await client!.multicall({
            contracts: Array.from({ length: Math.min(total, 50) }, (_, i) => ({
              address: PRIVATE_OTC_ADDRESS,
              abi: privateOtcAbi,
              functionName: "intents" as const,
              args: [BigInt(i)] as const,
            })),
            allowFailure: true,
          });

          for (const r of batch) {
            if (r.status !== "success") continue;
            const data = r.result as unknown as readonly [
              string, string, string, string, string, bigint, number, number, string,
            ];
            if (data[6] === 0) open++;
            if (data[7] === 1) rfq++;
            else direct++;
          }
        }

        let ethBal = "0";
        let cusdcBal = "0";
        let cethBal = "0";

        if (address) {
          try {
            const bal = await client!.getBalance({ address });
            ethBal = (Number(bal) / 1e18).toFixed(4);
          } catch { /* silent */ }

          try {
            const cusdc = await client!.readContract({
              address: CUSDC_ADDRESS,
              abi: erc7984Abi,
              functionName: "confidentialBalanceOf",
              args: [address],
            });
            cusdcBal = cusdc === "0x" + "0".repeat(64) ? "0" : "encrypted";
          } catch { /* silent */ }

          try {
            const ceth = await client!.readContract({
              address: CETH_ADDRESS,
              abi: erc7984Abi,
              functionName: "confidentialBalanceOf",
              args: [address],
            });
            cethBal = ceth === "0x" + "0".repeat(64) ? "0" : "encrypted";
          } catch { /* silent */ }
        }

        if (!cancelled) {
          setStats({
            totalIntents: total,
            openIntents: open,
            rfqIntents: rfq,
            directIntents: direct,
            ethBalance: ethBal,
            cusdcBalance: cusdcBal,
            cethBalance: cethBal,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) setStats((prev) => ({ ...prev, isLoading: false }));
      }
    }

    void fetch();
    return () => { cancelled = true; };
  }, [client, address]);

  return stats;
}
