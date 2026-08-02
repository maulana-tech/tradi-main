"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

export type TradeRow = {
  id: bigint;
  maker: string;
  taker: string;
  sellToken: string;
  buyToken: string;
  mode: number;
  status: number;
  createdAt: number;
  settledAt: number | null;
};

const TOKEN_NAMES: Record<string, string> = {
  ["0x5269822fc0127a9531c6b63df0227e463e8dc411".toLowerCase()]: "cUSDC",
  ["0x2774c01b0de131aeefb7f668ee8b6f326b66d276".toLowerCase()]: "cETH",
};

export function tokenName(addr: string): string {
  return TOKEN_NAMES[addr.toLowerCase()] ?? `${addr.slice(0, 6)}…`;
}

export function useTradeHistory() {
  const client = usePublicClient();
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      try {
        const nextId = await client!.readContract({
          address: PRIVATE_OTC_ADDRESS,
          abi: privateOtcAbi,
          functionName: "nextIntentId",
        });

        const total = Number(nextId);
        if (total === 0) { if (!cancelled) { setRows([]); setIsLoading(false); } return; }

        const [createdLogs, settledLogs] = await Promise.all([
          client!.getLogs({
            address: PRIVATE_OTC_ADDRESS,
            event: parseAbiItem(
              "event IntentCreated(uint256 indexed id, address indexed maker, address sellToken, address buyToken, uint8 mode, uint64 deadline)"
            ),
            fromBlock: 0n,
            toBlock: "latest",
          }),
          client!.getLogs({
            address: PRIVATE_OTC_ADDRESS,
            event: parseAbiItem(
              "event Settled(uint256 indexed id, address indexed taker)"
            ),
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ]);

        const settledMap = new Map<bigint, { taker: string; blockNumber: bigint }>();
        for (const log of settledLogs) {
          if (log.args.id !== undefined && log.args.taker !== undefined) {
            settledMap.set(log.args.id, {
              taker: log.args.taker,
              blockNumber: log.blockNumber,
            });
          }
        }

        const createdEntries: {
          id: bigint;
          maker: string;
          sellToken: string;
          buyToken: string;
          mode: number;
          timestamp: number;
        }[] = [];

        for (const log of createdLogs) {
          const block = await client!.getBlock({ blockNumber: log.blockNumber });
          if (log.args.id !== undefined && log.args.maker !== undefined) {
            createdEntries.push({
              id: log.args.id,
              maker: log.args.maker,
              sellToken: log.args.sellToken ?? "",
              buyToken: log.args.buyToken ?? "",
              mode: log.args.mode ?? 0,
              timestamp: Number(block.timestamp),
            });
          }
        }

        const createdMap = new Map(createdEntries.map((e) => [e.id, e]));

        const batchResult = await client!.multicall({
          contracts: Array.from({ length: total }, (_, i) => ({
            address: PRIVATE_OTC_ADDRESS,
            abi: privateOtcAbi,
            functionName: "intents" as const,
            args: [BigInt(i)] as const,
          })),
          allowFailure: true,
        });

        const result: TradeRow[] = [];
        for (let i = 0; i < batchResult.length; i++) {
          const r = batchResult[i];
          if (r.status !== "success") continue;
          const data = r.result as readonly [
            string, string, string, string, string, bigint, number, number, string, string,
          ];
          const created = createdMap.get(BigInt(i));
          const settled = settledMap.get(BigInt(i));

          let settledTimestamp: number | null = null;
          if (settled) {
            const block = await client!.getBlock({ blockNumber: settled.blockNumber });
            settledTimestamp = Number(block.timestamp);
          }

          result.push({
            id: BigInt(i),
            maker: data[0],
            taker: settled?.taker ?? "—",
            sellToken: data[1],
            buyToken: data[2],
            mode: data[7],
            status: data[6],
            createdAt: created?.timestamp ?? 0,
            settledAt: settledTimestamp,
          });
        }

        result.reverse();
        if (!cancelled) setRows(result);
      } catch (e) {
        console.error("useTradeHistory error:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [client]);

  return { rows, isLoading };
}
