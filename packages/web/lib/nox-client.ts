/**
 * Nox client — encryption + decryption helpers via @iexec-nox/handle.
 *
 * Public API:
 *   - `useNoxClient()` — React hook returning a memoized HandleClient
 *   - `encryptUint256(client, value, contract)` — encrypt + format for Solidity call
 *
 * Reference: https://github.com/iExec-Nox/nox-handle-sdk
 */

import {
  createViemHandleClient,
  type HandleClient,
  type Handle,
} from "@iexec-nox/handle";
import type { Hex } from "viem";
import { useMemo } from "react";
import { useWalletClient } from "wagmi";

/**
 * Encrypt a uint256 value off-chain. Returns the encrypted handle + proof
 * that should be passed verbatim to a Nox-enabled contract function expecting
 * `(externalEuint256 handle, bytes proof)`.
 *
 * @param client   HandleClient (created via {@link useNoxClient})
 * @param value    Plaintext uint256 (bigint) to encrypt
 * @param contract Address of the contract that will validate the proof
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
 * ACL (granted via `Nox.allow(handle, msg.sender)` in Solidity).
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
 * Used when a contract called `Nox.allowPublicDecryption(handle)`.
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
 *
 * Note: `createViemHandleClient` is async; we resolve lazily on first use.
 *
 * Coverage: this hook can't run under our Vitest setup because of the React 19
 * + pnpm + Windows two-React-copies issue documented elsewhere. Excluded.
 */
/* v8 ignore start */
export function useNoxClient(): {
  ready: boolean;
  getClient: () => Promise<HandleClient | null>;
} {
  const { data: walletClient } = useWalletClient();

  const getClient = useMemo(() => {
    let cached: Promise<HandleClient> | null = null;
    return async () => {
      if (!walletClient) return null;
      if (!cached) {
        cached = createViemHandleClient(walletClient);
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
