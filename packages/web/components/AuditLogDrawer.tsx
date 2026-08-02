"use client";

import { KeeperHubAuditLog } from "@/lib/hooks/useKeeperHubAudit";
import { Icon } from "./Icon";
import { Badge } from "./ui/Badge";

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  audit: KeeperHubAuditLog | null;
}

export function AuditLogDrawer({ isOpen, onClose, audit }: AuditLogDrawerProps) {
  if (!isOpen || !audit) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
            <div className="flex items-center gap-2">
              <Icon name="shield" className="size-5 text-[var(--color-primary-text)]" />
              <h3 className="font-display text-lg font-semibold text-white">
                KeeperHub Audit Log
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)] hover:text-white"
            >
              <Icon name="close" className="size-5" />
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <span className="text-xs text-[var(--color-text-muted)]">Intent ID</span>
              <p className="mt-1 font-mono text-sm font-medium text-white">
                #{audit.intentId}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-low)] p-4">
              <div>
                <span className="text-xs text-[var(--color-text-muted)]">Execution Engine</span>
                <div className="mt-1">
                  <Badge tone={audit.routedVia === "KeeperHub Relayed" ? "success" : "neutral"}>
                    {audit.routedVia}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs text-[var(--color-text-muted)]">Simulation Status</span>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {audit.simulationStatus}
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Gas Sponsored</span>
                <span className="font-semibold text-white">
                  {audit.gasSponsored ? "Yes (100% Zero-Cost)" : "No (Direct)"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Gas Estimate / Used</span>
                <span className="font-mono text-xs text-white">{audit.gasUsed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">MEV Protection</span>
                <span className="font-semibold text-emerald-400">Active</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Execution Time</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{audit.timestamp}</span>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <span className="text-xs text-[var(--color-text-muted)]">Transaction Hash</span>
              <p className="mt-1 break-all font-mono text-xs text-[var(--color-primary-text)]">
                {audit.txHash}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
