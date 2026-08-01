import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  // Enable via `ANALYZE=true pnpm build` — opens reports in browser.
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Wagmi/RainbowKit pulls some Node-only deps. Mark these external in server build.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
};

export default withBundleAnalyzer(nextConfig);
