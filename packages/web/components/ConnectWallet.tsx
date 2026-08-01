"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { shortAddress } from "@/lib/utils";

function getWalletStyle(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("rabby")) return { bg: "#dbeafe", fg: "#2563eb", icon: "smart_wallet" };
  if (lower.includes("metamask")) return { bg: "#fef3c7", fg: "#d97706", icon: "account_balance_wallet" };
  if (lower.includes("phantom")) return { bg: "#ede9fe", fg: "#7c3aed", icon: "account_balance_wallet" };
  return { bg: "#f0fdf4", fg: "#16a34a", icon: "account_balance_wallet" };
}

function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connect, connectors, isPending } = useConnect();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-surface] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[--color-border] px-5 py-4">
          <h3 className="text-sm font-semibold text-[--color-foreground]">
            Connect Wallet
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[--color-text-muted] transition-colors hover:bg-[--color-surface-low] hover:text-[--color-foreground]"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="flex flex-col gap-1 p-3">
          {connectors.map((c) => {
            const style = getWalletStyle(c.name);
            return (
              <button
                key={c.uid}
                onClick={() => {
                  connect({ connector: c });
                  onClose();
                }}
                disabled={isPending}
                className="flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-sm font-medium text-[--color-foreground] transition-colors hover:bg-[--color-surface-low] active:scale-[0.98] disabled:opacity-50"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: style.bg }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: style.fg }}
                  >
                    {style.icon}
                  </span>
                </span>
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="border-t border-[--color-border] px-5 py-3">
          <p className="text-center text-[11px] text-[--color-text-muted]">
            By connecting, you agree to the Terms of Service
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ConnectedDropdown() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!address) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-surface-low] px-3 py-1.5 text-xs font-medium text-[--color-foreground] transition-colors hover:bg-[--color-border]/50"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
        {shortAddress(address, 4)}
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>
      {open && (
        <div className="slide-down absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] shadow-xl">
          <div className="border-b border-[--color-border] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[--color-text-muted]">
              Connected
            </p>
            <p className="mt-1 font-mono text-xs text-[--color-text]">
              {shortAddress(address, 8)}
            </p>
          </div>
          <button
            onClick={() => { disconnect(); setOpen(false); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[--color-danger] transition-colors hover:bg-red-50"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export function ConnectWallet() {
  const { isConnected } = useAccount();
  const { isPending } = useConnect();
  const [open, setOpen] = useState(false);

  if (isConnected) {
    return <ConnectedDropdown />;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="rounded-lg bg-[--color-primary] px-3 py-1.5 text-xs font-semibold text-[--color-primary-fg] transition-colors hover:bg-[#1a6b2e] disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect"}
      </button>
      <WalletModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
