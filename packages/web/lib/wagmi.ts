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
  (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS as `0x${string}`) ||
  "0xE45cf4bcbF060Ada54188203684a18db1A3aeFC2";

export const CUSDC_ADDRESS =
  (process.env.NEXT_PUBLIC_CUSDC_ADDRESS as `0x${string}`) ||
  "0x5269822fc0127A9531c6B63dF0227E463e8DC411";

export const CETH_ADDRESS =
  (process.env.NEXT_PUBLIC_CETH_ADDRESS as `0x${string}`) ||
  "0x2774C01B0De131aEEFb7F668ee8B6f326B66D276";

export const TRADI_NOX_RECEIPT_ADDRESS =
  (process.env.NEXT_PUBLIC_TRADI_NOX_RECEIPT_ADDRESS as `0x${string}`) ||
  "0x1fCFb4176e71e7298011a55B57F033E0c8881634";
