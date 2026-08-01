import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["lib/**/*.ts", "lib/**/*.tsx"],
      exclude: [
        "lib/**/*.d.ts",
        "lib/abi/**",
        "lib/wagmi.ts", // env-dependent config
        // React-glue hooks: testable behavior is in *.logic.ts (100%
        // covered). The .ts files here are thin wagmi/Nox dep wiring
        // that the React 19 + Vitest + pnpm + Windows stack can't
        // currently render under unit tests.
        "lib/hooks/useFaucet.ts",
        "lib/hooks/useCreateIntent.ts",
        "lib/hooks/useOtcWrites.ts",
        // Same pattern: pure-React hooks wrapping wagmi reads/writes +
        // viem getLogs. No business logic to test in isolation —
        // behavior is exercised end-to-end by the manual demo flow.
        "lib/hooks/useSetOperator.ts",
        "lib/hooks/useSettledTaker.ts",
        "lib/hooks/useReceiptMint.ts",
        "lib/hooks/useExistingReceipt.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 95,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
