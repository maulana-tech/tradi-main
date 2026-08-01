"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState, useRef, useEffect } from "react";
import { shortAddress } from "@/lib/utils";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
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

  if (isConnected && address) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-1.5 text-sm font-medium text-[--color-foreground]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
          {shortAddress(address, 4)}
        </button>
        {open && (
          <div className="slide-down absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-[--color-border] bg-[--color-surface] shadow-lg">
            <div className="border-b border-[--color-border] px-3 py-2">
              <p className="font-mono text-xs text-[--color-text]">{shortAddress(address, 8)}</p>
            </div>
            <button
              onClick={() => { disconnect(); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-[--color-danger] hover:bg-[--color-surface-low]"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="rounded-md bg-[--color-primary] px-4 py-1.5 text-xs font-semibold text-[--color-primary-fg] hover:bg-[#1a6b2e] disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="slide-down w-full max-w-sm overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[--color-border] px-5 py-4">
              <h3 className="text-sm font-semibold text-[--color-foreground]">Connect Wallet</h3>
              <button onClick={() => setOpen(false)} className="text-[--color-text-muted] hover:text-[--color-foreground]">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1 p-3">
              {connectors.map(c => (
                <button
                  key={c.uid}
                  onClick={() => { connect({ connector: c }); setOpen(false); }}
                  disabled={isPending}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-[--color-foreground] hover:bg-[--color-surface-low] disabled:opacity-50"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-100">
                    <span className="material-symbols-outlined text-lg text-orange-600">account_balance_wallet</span>
                  </span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
