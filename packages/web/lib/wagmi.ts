"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, arbitrumSepolia, arbitrum } from "wagmi/chains";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "97aaa300062a00e51e177bc4ffc268c9";

export const wagmiConfig = getDefaultConfig({
  appName: "Tradi-Nox",
  projectId,
  chains: [sepolia, arbitrumSepolia, arbitrum],
  ssr: true,
});

export const PRIVATE_OTC_ADDRESS =
  (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS as `0x${string}`) ?? "0x0";

export const CUSDC_ADDRESS =
  (process.env.NEXT_PUBLIC_CUSDC_ADDRESS as `0x${string}`) ?? "0x0";

export const CETH_ADDRESS =
  (process.env.NEXT_PUBLIC_CETH_ADDRESS as `0x${string}`) ?? "0x0";

export const TRADI_NOX_RECEIPT_ADDRESS =
  (process.env.NEXT_PUBLIC_TRADI_NOX_RECEIPT_ADDRESS as `0x${string}`) ?? "0x0";
