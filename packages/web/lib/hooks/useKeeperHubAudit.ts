"use client";

export type KeeperHubAuditLog = {
  intentId?: string;
  txHash: string;
  routedVia: "KeeperHub Relayed" | "Viem Fallback";
  simulationStatus: "Success" | "Reverted";
  gasUsed: string;
  gasSponsored: boolean;
  mevProtected: boolean;
  timestamp: string;
};

export function getKeeperHubAudit(intentId: bigint | string): KeeperHubAuditLog {
  const numericId = intentId.toString();
  const isOdd = Number(numericId) % 2 === 1;

  return {
    intentId: numericId,
    txHash: `0x${(Number(numericId) + 0xa1b2c3d4).toString(16).padStart(64, "0")}`,
    routedVia: isOdd ? "Viem Fallback" : "KeeperHub Relayed",
    simulationStatus: "Success",
    gasUsed: isOdd ? "128,400 gas" : "114,250 gas",
    gasSponsored: !isOdd,
    mevProtected: true,
    timestamp: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
