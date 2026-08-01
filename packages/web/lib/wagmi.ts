import { http, createConfig } from "wagmi";
import { sepolia, arbitrumSepolia, arbitrum } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [sepolia, arbitrumSepolia, arbitrum],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [arbitrum.id]: http(),
  },
});

export const PRIVATE_OTC_ADDRESS =
  (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS as `0x${string}`) ?? "0x0";

export const CUSDC_ADDRESS =
  (process.env.NEXT_PUBLIC_CUSDC_ADDRESS as `0x${string}`) ?? "0x0";

export const CETH_ADDRESS =
  (process.env.NEXT_PUBLIC_CETH_ADDRESS as `0x${string}`) ?? "0x0";

export const TRADI_NOX_RECEIPT_ADDRESS =
  (process.env.NEXT_PUBLIC_TRADI_NOX_RECEIPT_ADDRESS as `0x${string}`) ?? "0x0";
