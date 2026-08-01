import { describe, test, expect, vi } from "vitest";

vi.mock("@iexec-nox/handle", () => ({
  createViemHandleClient: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useWalletClient: vi.fn(),
}));

import {
  encryptUint256,
  decryptUint256,
  publicDecryptUint256,
} from "../nox-client";

const CONTRACT = "0xContract" as `0x${string}`;

function makeClient(overrides: {
  encryptInput?: ReturnType<typeof vi.fn>;
  decrypt?: ReturnType<typeof vi.fn>;
  publicDecrypt?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    encryptInput: overrides.encryptInput ?? vi.fn(),
    decrypt: overrides.decrypt ?? vi.fn(),
    publicDecrypt: overrides.publicDecrypt ?? vi.fn(),
  };
}

describe("encryptUint256", () => {
  describe("positive cases", () => {
    test("calls client.encryptInput with value, type 'uint256', contract", async () => {
      const encryptInput = vi.fn().mockResolvedValue({
        handle: "0xH",
        handleProof: "0xP",
      });
      const client = makeClient({ encryptInput });

      const out = await encryptUint256(client as never, 1234n, CONTRACT);

      expect(encryptInput).toHaveBeenCalledWith(1234n, "uint256", CONTRACT);
      expect(out).toEqual({ handle: "0xH", proof: "0xP" });
    });

    test("renames handleProof to proof in returned shape", async () => {
      const client = makeClient({
        encryptInput: vi.fn().mockResolvedValue({
          handle: "0xAA",
          handleProof: "0xBB",
        }),
      });
      const out = await encryptUint256(client as never, 0n, CONTRACT);
      expect(out.handle).toBe("0xAA");
      expect(out.proof).toBe("0xBB");
    });
  });

  describe("negative cases", () => {
    test("propagates rejection from underlying encryptInput", async () => {
      const client = makeClient({
        encryptInput: vi.fn().mockRejectedValue(new Error("nox down")),
      });
      await expect(
        encryptUint256(client as never, 1n, CONTRACT),
      ).rejects.toThrow("nox down");
    });
  });

  describe("edge cases", () => {
    test("supports max uint256 value", async () => {
      const max = 2n ** 256n - 1n;
      const encryptInput = vi.fn().mockResolvedValue({
        handle: "0xMAX",
        handleProof: "0xMAXP",
      });
      const client = makeClient({ encryptInput });
      await encryptUint256(client as never, max, CONTRACT);
      expect(encryptInput).toHaveBeenCalledWith(max, "uint256", CONTRACT);
    });

    test("supports zero value (legitimate Strategy B input)", async () => {
      const encryptInput = vi.fn().mockResolvedValue({
        handle: "0x0H",
        handleProof: "0x0P",
      });
      const client = makeClient({ encryptInput });
      const out = await encryptUint256(client as never, 0n, CONTRACT);
      expect(encryptInput).toHaveBeenCalledWith(0n, "uint256", CONTRACT);
      expect(out.handle).toBe("0x0H");
    });
  });
});

describe("decryptUint256", () => {
  describe("positive cases", () => {
    test("returns the decrypted value as bigint from client.decrypt", async () => {
      const decrypt = vi.fn().mockResolvedValue({ value: 5n });
      const client = makeClient({ decrypt });
      const v = await decryptUint256(client as never, "0xHANDLE");
      expect(v).toBe(5n);
      expect(decrypt).toHaveBeenCalledWith("0xHANDLE");
    });
  });

  describe("negative cases", () => {
    test("propagates client.decrypt failure (e.g. caller not on ACL)", async () => {
      const client = makeClient({
        decrypt: vi.fn().mockRejectedValue(new Error("not authorized")),
      });
      await expect(
        decryptUint256(client as never, "0xH"),
      ).rejects.toThrow("not authorized");
    });
  });

  describe("edge cases", () => {
    test("returns 0n when handle decrypts to zero", async () => {
      const client = makeClient({
        decrypt: vi.fn().mockResolvedValue({ value: 0n }),
      });
      expect(await decryptUint256(client as never, "0xH")).toBe(0n);
    });
  });
});

describe("publicDecryptUint256", () => {
  describe("positive cases", () => {
    test("returns value + decryptionProof from publicDecrypt", async () => {
      const publicDecrypt = vi.fn().mockResolvedValue({
        value: 9n,
        decryptionProof: "0xProof",
      });
      const client = makeClient({ publicDecrypt });
      const out = await publicDecryptUint256(client as never, "0xH");
      expect(out.value).toBe(9n);
      expect(out.decryptionProof).toBe("0xProof");
      expect(publicDecrypt).toHaveBeenCalledWith("0xH");
    });
  });

  describe("negative cases", () => {
    test("propagates publicDecrypt failure", async () => {
      const client = makeClient({
        publicDecrypt: vi
          .fn()
          .mockRejectedValue(new Error("handle not publicly decryptable")),
      });
      await expect(
        publicDecryptUint256(client as never, "0xH"),
      ).rejects.toThrow("not publicly decryptable");
    });
  });
});
