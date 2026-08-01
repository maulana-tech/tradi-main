/**
 * Pure async logic for the Direct OTC createIntent flow.
 *
 * Decoupled from the React hook so we can unit-test every branch
 * (positive/negative/edge) under London-school strict — every dep is mocked.
 */
import type { Hex } from "viem";
import type { HandleClient } from "@iexec-nox/handle";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

export type CreateIntentInput = {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount: bigint;
  minBuyAmount: bigint;
  deadlineSeconds: number;
  allowedTaker?: `0x${string}`;
};

export type CreateIntentStep =
  | "idle"
  | "encrypting"
  | "signing"
  | "confirming"
  | "done"
  | "error";

export type CreateIntentDeps = {
  address: `0x${string}` | undefined;
  noxReady: boolean;
  privateOtcAddress: `0x${string}`;
  getClient: () => Promise<HandleClient | null>;
  encryptAmount: (
    client: HandleClient,
    amount: bigint,
    contract: `0x${string}`,
  ) => Promise<{ handle: Hex; proof: Hex }>;
  writeContractAsync: (args: unknown) => Promise<`0x${string}`>;
  /** Returns current Unix epoch seconds. Injected for testability. */
  nowSeconds: () => number;
};

export type CreateIntentCallbacks = {
  onStep: (step: CreateIntentStep) => void;
  onError: (msg: string | null) => void;
  onTxHash: (hash: `0x${string}`) => void;
};

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

export async function executeCreateIntent(
  deps: CreateIntentDeps,
  input: CreateIntentInput,
  cb: CreateIntentCallbacks,
): Promise<void> {
  if (!deps.address) throw new Error("Wallet not connected");
  if (!deps.noxReady) throw new Error("Nox client not ready");
  cb.onError(null);

  try {
    cb.onStep("encrypting");
    const client = await deps.getClient();
    if (!client) throw new Error("Nox client unavailable");

    const sell = await deps.encryptAmount(
      client,
      input.sellAmount,
      deps.privateOtcAddress,
    );
    const minBuy = await deps.encryptAmount(
      client,
      input.minBuyAmount,
      deps.privateOtcAddress,
    );

    cb.onStep("signing");
    const deadline =
      BigInt(deps.nowSeconds()) + BigInt(input.deadlineSeconds);

    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "createIntent",
      args: [
        input.sellToken,
        input.buyToken,
        sell.handle as `0x${string}`,
        sell.proof,
        minBuy.handle as `0x${string}`,
        minBuy.proof,
        deadline,
        input.allowedTaker ?? ZERO_ADDRESS,
      ],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Walk the receipt logs and return the IntentCreated event's id, or null.
 *
 * @param decodeEventLog Injected viem decoder so tests can stub it.
 */
export function parseIntentCreatedId(
  logs: { data: `0x${string}`; topics: readonly `0x${string}`[] }[],
  decodeEventLog: (args: {
    abi: unknown;
    data: `0x${string}`;
    topics: readonly `0x${string}`[];
  }) => { eventName: string; args: { id: bigint } } | null,
): bigint | null {
  for (const log of logs) {
    let decoded: { eventName: string; args: { id: bigint } } | null;
    try {
      decoded = decodeEventLog({
        abi: privateOtcAbi,
        data: log.data,
        topics: log.topics,
      });
    } catch {
      continue;
    }
    if (decoded && decoded.eventName === "IntentCreated") {
      return decoded.args.id;
    }
  }
  return null;
}
