"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";

const UNISWAP_V3_POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640" as const;

const POOL_ABI = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint32" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const;

export type PricePoint = {
  timestamp: number;
  price: number;
};

function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const Q192 = BigInt(2) ** BigInt(192);
  const price = Number((sqrtPriceX96 * sqrtPriceX96 * BigInt(10 ** decimals0)) / Q192) / (10 ** decimals1);
  return price;
}

export function useUniswapPrice() {
  const client = usePublicClient();
  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    let active = true;

    async function fetch() {
      try {
        const slot0 = await client!.readContract({
          address: UNISWAP_V3_POOL,
          abi: POOL_ABI,
          functionName: "slot0",
        });
        const ethUsdcPrice = sqrtPriceX96ToPrice(slot0[0], 6, 18);
        if (active) setPrice(ethUsdcPrice);
      } catch (e) {
        console.error("useUniswapPrice error:", e);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetch();
    const interval = setInterval(fetch, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [client]);

  return { price, isLoading };
}

export function usePriceHistory() {
  const client = usePublicClient();
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    let active = true;

    async function fetch() {
      try {
        const currentBlock = await client!.getBlockNumber();
        const interval = 2400n; // ~8 hours in blocks (12s each)
        const points: PricePoint[] = [];

        for (let i = 0n; i < 30n; i++) {
          const blockNum = currentBlock - i * interval;
          if (blockNum < 0n) break;

          try {
            const slot0 = await client!.readContract({
              address: UNISWAP_V3_POOL,
              abi: POOL_ABI,
              functionName: "slot0",
              blockNumber: blockNum,
            });
            const block = await client!.getBlock({ blockNumber: blockNum });
            const price = sqrtPriceX96ToPrice(slot0[0], 6, 18);
            points.unshift({
              timestamp: Number(block.timestamp),
              price,
            });
          } catch {
            // skip failed blocks
          }
        }

        if (active) setHistory(points);
      } catch (e) {
        console.error("usePriceHistory error:", e);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetch();
    return () => { active = false; };
  }, [client]);

  return { history, isLoading };
}
