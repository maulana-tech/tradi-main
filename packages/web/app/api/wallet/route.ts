import { NextRequest, NextResponse } from "next/server";

const KEEPERHUB_MCP_URL = "https://app.keeperhub.com/mcp";

interface WalletInfo {
  id: string;
  address: string;
  type: "keeperhub-managed" | "api-key";
  label: string;
  chains: string[];
  createdAt: string;
}

// In-memory store
const globalForWallets = globalThis as unknown as {
  walletStore: Map<string, WalletInfo> | undefined;
};

const store: Map<string, WalletInfo> =
  globalForWallets.walletStore ?? new Map();
globalForWallets.walletStore = store;

let cachedSessionId: string | null = null;
let sessionExpiresAt = 0;

async function getMcpSessionId(apiKey: string): Promise<string> {
  if (cachedSessionId && Date.now() < sessionExpiresAt) return cachedSessionId;

  const initRes = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "tradi", version: "1.0.0" } } }),
  });

  if (!initRes.ok) throw new Error(`KeeperHub init failed: ${initRes.status}`);
  const sessionId = initRes.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("No session ID");

  await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  cachedSessionId = sessionId;
  sessionExpiresAt = Date.now() + 55 * 60 * 1000;
  return sessionId;
}

async function keeperhubCall(apiKey: string, toolName: string, args: Record<string, unknown>) {
  const sessionId = await getMcpSessionId(apiKey);

  const response = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) { cachedSessionId = null; sessionExpiresAt = 0; }
    throw new Error(`KeeperHub ${response.status}`);
  }

  const body = (await response.json()) as { result?: { content?: Array<{ type: string; text: string }> }; error?: { message: string; code?: number } };
  if (body.error) {
    if (body.error.code === -32003) { cachedSessionId = null; sessionExpiresAt = 0; }
    throw new Error(`KeeperHub: ${body.error.message}`);
  }

  const text = body.result?.content?.[0]?.text;
  if (!text) throw new Error("Empty response");
  try { return JSON.parse(text); } catch { return text; }
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  // List stored wallets
  if (action === "list") {
    const wallets = Array.from(store.values());
    return NextResponse.json({ wallets, total: wallets.length });
  }

  // Get wallet from KeeperHub API key
  if (action === "keeperhub") {
    const apiKey = request.nextUrl.searchParams.get("apiKey") ?? process.env.KEEPERHUB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

    try {
      const integrations = await keeperhubCall(apiKey, "list_integrations", {});
      const wallets = Array.isArray(integrations) ? integrations : [];

      const web3Wallets = wallets.filter((w: Record<string, unknown>) => w.type === "web3");

      return NextResponse.json({
        ok: true,
        wallets: web3Wallets.map((w: Record<string, unknown>) => ({
          id: w.id as string,
          address: w.address as string ?? w.label as string,
          type: "web3",
          name: w.name as string ?? w.label as string,
        })),
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  // Get wallet balance
  if (action === "balance") {
    const address = request.nextUrl.searchParams.get("address");
    const chainId = request.nextUrl.searchParams.get("chainId") ?? "421614";
    const apiKey = request.nextUrl.searchParams.get("apiKey") ?? process.env.KEEPERHUB_API_KEY;

    if (!address || !apiKey) return NextResponse.json({ error: "address and apiKey required" }, { status: 400 });

    try {
      const result = await keeperhubCall(apiKey, "execute_contract_call", {
        chain_id: chainId,
        contract_address: address,
        function_name: "getBalance",
        args: [],
        simulate: true,
      });
      return NextResponse.json({ ok: true, data: result });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  // Get spending limits
  if (action === "limits") {
    const apiKey = request.nextUrl.searchParams.get("apiKey") ?? process.env.KEEPERHUB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

    try {
      const result = await keeperhubCall(apiKey, "get_spending_limits", {});
      return NextResponse.json({ ok: true, data: result });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "connect-api-key" | "create-managed";
      apiKey?: string;
      label?: string;
    };

    // Connect via KeeperHub API key
    if (body.action === "connect-api-key") {
      if (!body.apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

      try {
        const integrations = await keeperhubCall(body.apiKey, "list_integrations", {});
        const wallets = Array.isArray(integrations) ? integrations : [];
        const web3Wallet = wallets.find((w: Record<string, unknown>) => w.type === "web3");

        if (!web3Wallet) {
          return NextResponse.json({ error: "No web3 wallet found in KeeperHub account" }, { status: 404 });
        }

        const wallet: WalletInfo = {
          id: `kh-${(web3Wallet as Record<string, unknown>).id as string}`,
          address: ((web3Wallet as Record<string, unknown>).address as string) ?? ((web3Wallet as Record<string, unknown>).label as string),
          type: "api-key",
          label: body.label ?? "KeeperHub Wallet",
          chains: ["Sepolia", "Base Sepolia", "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon"],
          createdAt: new Date().toISOString(),
        };

        store.set(wallet.id, wallet);

        return NextResponse.json({ ok: true, wallet });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // Create managed wallet (uses default KeeperHub API key)
    if (body.action === "create-managed") {
      const apiKey = process.env.KEEPERHUB_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "KEEPERHUB_API_KEY not configured" }, { status: 500 });

      try {
        const integrations = await keeperhubCall(apiKey, "list_integrations", {});
        const wallets = Array.isArray(integrations) ? integrations : [];
        const web3Wallet = wallets.find((w: Record<string, unknown>) => w.type === "web3");

        if (!web3Wallet) {
          return NextResponse.json({ error: "No wallet available in platform account" }, { status: 404 });
        }

        const wallet: WalletInfo = {
          id: `managed-${Date.now()}`,
          address: ((web3Wallet as Record<string, unknown>).address as string) ?? ((web3Wallet as Record<string, unknown>).label as string),
          type: "keeperhub-managed",
          label: body.label ?? "Tradi Wallet",
          chains: ["Sepolia", "Base Sepolia", "Ethereum", "Base", "Arbitrum", "Optimism", "Polygon"],
          createdAt: new Date().toISOString(),
        };

        store.set(wallet.id, wallet);

        return NextResponse.json({ ok: true, wallet });
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
