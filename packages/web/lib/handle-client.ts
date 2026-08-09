/**
 * Handle client — encryption + decryption helpers via the confidential handle SDK.
 *
 * Public API:
 *   - `useHandleClient()` — React hook returning a memoized HandleClient
 *   - `encryptUint256(client, value, contract)` — encrypt + format for Solidity call
 */

import {
  createViemHandleClient,
  type HandleClient,
  type Handle,
} from "@iexec-nox/handle";
import type { Hex } from "viem";
import { useMemo } from "react";
import { useWalletClient } from "wagmi";

const HANDLE_CONFIG = {
  gatewayUrl: "https://gateway-testnets.noxprotocol.dev" as const,
  smartContractAddress: "0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF" as `0x${string}`,
  subgraphUrl: "https://thegraph.ethereum-sepolia-testnet.noxprotocol.io/api/subgraphs/id/9CsccKwvgYFo72zZeU4k4wj2NEBLdWhVE3EUandgmzgo" as const,
};

export type { HandleClient, Handle };

/**
 * Encrypt a uint256 value off-chain. Returns the encrypted handle + proof
 * that should be passed verbatim to a contract function expecting
 * `(externalEuint256 handle, bytes proof)`.
 */
export async function encryptUint256(
  client: HandleClient,
  value: bigint,
  contract: `0x${string}`
): Promise<{ handle: Hex; proof: Hex }> {
  const { handle, handleProof } = await client.encryptInput(
    value,
    "uint256",
    contract
  );
  return { handle: handle as Hex, proof: handleProof as Hex };
}

/**
 * Decrypt a handle returned by the contract. Caller MUST be on the handle's
 * ACL (granted via handle allow in Solidity).
 */
export async function decryptUint256(
  client: HandleClient,
  handle: Hex
): Promise<bigint> {
  const result = await client.decrypt(handle as Handle<"uint256">);
  return result.value as bigint;
}

/**
 * Decrypt a publicly-decryptable handle (no ACL required).
 * Used when a contract called public decryption on the handle.
 */
export async function publicDecryptUint256(
  client: HandleClient,
  handle: Hex
): Promise<{ value: bigint; decryptionProof: Hex }> {
  const result = await client.publicDecrypt(handle as Handle<"uint256">);
  return {
    value: result.value as bigint,
    decryptionProof: result.decryptionProof as Hex,
  };
}

/**
 * React hook — returns a HandleClient bound to the connected wallet.
 *
 * Returns `undefined` until wallet is connected. Call sites should guard
 * with `if (!client) return;` before invoking encrypt/decrypt.
 */
/* v8 ignore start */
export function useHandleClient(): {
  ready: boolean;
  getClient: () => Promise<HandleClient | null>;
} {
  const { data: walletClient } = useWalletClient();

  const getClient = useMemo(() => {
    let cached: Promise<HandleClient> | null = null;
    return async () => {
      if (!walletClient) return null;
      if (!cached) {
        cached = createViemHandleClient(walletClient, HANDLE_CONFIG);
      }
      return cached;
    };
  }, [walletClient]);

  return {
    ready: Boolean(walletClient),
    getClient,
  };
}
/* v8 ignore stop */
