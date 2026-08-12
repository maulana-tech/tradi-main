"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";

interface WalletInfo {
  id: string;
  address: string;
  type: "keeperhub-managed" | "api-key";
  label: string;
  chains: string[];
  createdAt: string;
}

export default function WalletPage() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet?action=list");
      const data = (await res.json()) as { wallets: WalletInfo[] };
      setWallets(data.wallets);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallets();
  }, [fetchWallets]);

  async function connectApiKey() {
    if (!apiKey.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect-api-key", apiKey: apiKey.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; wallet?: WalletInfo; error?: string };
      if (data.ok && data.wallet) {
        setWallets((prev) => [...prev, data.wallet!]);
        setApiKey("");
      } else {
        setError(data.error ?? "Failed to connect");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function createManaged() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-managed" }),
      });
      const data = (await res.json()) as { ok: boolean; wallet?: WalletInfo; error?: string };
      if (data.ok && data.wallet) {
        setWallets((prev) => [...prev, data.wallet!]);
      } else {
        setError(data.error ?? "Failed to create wallet");
      }
    } catch {
      setError("Creation failed");
    } finally {
      setConnecting(false);
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <AppShell>
      <PageHeader
        icon="account_balance_wallet"
        title="Wallet"
        subtitle="Connect your KeeperHub wallet or use an API key to manage your assets."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Connect via API Key</h3>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Enter your KeeperHub API key to connect your existing wallet. Your key is used to fetch wallet info and is not stored.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="kh_your_api_key_here"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-low)] px-3 py-2 font-mono text-sm text-white placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              <Button onClick={connectApiKey} disabled={connecting || !apiKey.trim()}>
                {connecting ? "Connecting..." : "Connect"}
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-[var(--color-danger-text)]">{error}</p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">Create Managed Wallet</h3>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Don&apos;t have a KeeperHub account? Create a managed wallet powered by KeeperHub&apos;s Turnkey integration. Your keys are stored in secure enclaves.
            </p>
            <Button onClick={createManaged} disabled={connecting} tone="secondary" className="w-full">
              {connecting ? "Creating..." : "Create Managed Wallet"}
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-white">How it works</h3>
            <div className="space-y-3">
              {[
                { icon: "vpn_key", title: "API Key Wallet", desc: "Connect your existing KeeperHub wallet via API key. Full control, your account." },
                { icon: "shield", title: "Managed Wallet", desc: "Tradi creates and manages the wallet via KeeperHub. Keys in secure enclaves." },
                { icon: "sync", title: "Auto-Execute", desc: "All trades and strategies execute through your connected wallet automatically." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <Icon name={item.icon} className="mt-0.5 size-4 text-[var(--color-primary-text)]" />
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Connected Wallets</h3>
          {loading ? (
            <Card className="h-32 animate-pulse p-6" />
          ) : wallets.length === 0 ? (
            <Card className="p-8 text-center">
              <Icon name="account_balance_wallet" className="mx-auto size-8 text-[var(--color-text-muted)]" />
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No wallets connected yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <Card key={wallet.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)]">
                        <Icon name={wallet.type === "api-key" ? "vpn_key" : "shield"} className="size-5 text-[var(--color-primary-text)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{wallet.label}</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs text-[var(--color-text-muted)]">
                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                          </p>
                          <button
                            onClick={() => copyAddress(wallet.address)}
                            className="text-[var(--color-text-muted)] hover:text-white"
                          >
                            <Icon name={copied === wallet.address ? "check" : "content_copy"} className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <Badge tone={wallet.type === "api-key" ? "primary" : "success"}>
                      {wallet.type === "api-key" ? "API Key" : "Managed"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {wallet.chains.map((chain) => (
                      <span key={chain} className="rounded-full bg-[var(--color-surface-low)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        {chain}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
