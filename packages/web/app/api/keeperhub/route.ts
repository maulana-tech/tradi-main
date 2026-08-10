import { NextRequest, NextResponse } from "next/server";

const KEEPERHUB_MCP_URL = "https://app.keeperhub.com/mcp";
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY ?? "";

let cachedSessionId: string | null = null;
let sessionExpiresAt = 0;

async function getMcpSessionId(): Promise<string> {
  if (cachedSessionId && Date.now() < sessionExpiresAt) {
    return cachedSessionId;
  }

  // Step 1: Initialize
  const initRes = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "tradi-platform", version: "1.0.0" },
      },
    }),
  });

  if (!initRes.ok) {
    throw new Error(`KeeperHub init failed: ${initRes.status}`);
  }

  const sessionId = initRes.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("KeeperHub returned no session ID");

  // Step 2: Send initialized notification
  await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  cachedSessionId = sessionId;
  sessionExpiresAt = Date.now() + 55 * 60 * 1000; // 55 min (session expires in 24h but we refresh)
  return sessionId;
}

async function keeperhubCall(toolName: string, args: Record<string, unknown>) {
  if (!KEEPERHUB_API_KEY) {
    throw new Error("KEEPERHUB_API_KEY not configured");
  }

  const sessionId = await getMcpSessionId();

  const response = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    // If session expired, clear cache and retry once
    if (response.status === 400 || response.status === 401) {
      cachedSessionId = null;
      sessionExpiresAt = 0;
    }
    throw new Error(`KeeperHub ${response.status}: ${text}`);
  }

  const body = (await response.json()) as {
    result?: { content?: Array<{ type: string; text: string }> };
    error?: { message: string; code?: number };
  };

  if (body.error) {
    // Session expired error — clear cache
    if (body.error.code === -32003) {
      cachedSessionId = null;
      sessionExpiresAt = 0;
    }
    throw new Error(`KeeperHub: ${body.error.message}`);
  }

  const text = body.result?.content?.[0]?.text;
  if (!text) throw new Error("KeeperHub returned empty response");

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  try {
    if (action === "chains") {
      const result = await keeperhubCall("list_action_schemas", {});
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "wallet") {
      const integrationId = request.nextUrl.searchParams.get("integrationId") ?? "turnkey";
      const result = await keeperhubCall("get_wallet_integration", { integrationId });
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "status") {
      const executionId = request.nextUrl.searchParams.get("executionId");
      if (!executionId) {
        return NextResponse.json({ error: "executionId required" }, { status: 400 });
      }
      const result = await keeperhubCall("get_direct_execution_status", { executionId });
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "test") {
      const result = await keeperhubCall("execute_contract_call", {
        chain_id: "421614",
        contract_address: "0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4",
        function_name: "nextIntentId",
        abi: [
          {
            type: "function",
            name: "nextIntentId",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint256" }],
          },
        ],
        args: [],
        simulate: true,
      });
      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "execute" | "simulate";
      chain_id: string;
      contract_address: string;
      function_name: string;
      abi?: unknown[];
      args?: unknown[];
      idempotencyKey?: string;
    };

    const params: Record<string, unknown> = {
      chain_id: body.chain_id,
      contract_address: body.contract_address,
      function_name: body.function_name,
      args: body.args ?? [],
    };

    if (body.abi) params.abi = body.abi;

    if (body.action === "simulate") {
      params.simulate = true;
      const result = await keeperhubCall("execute_contract_call", params);
      return NextResponse.json({ ok: true, data: result });
    }

    if (body.action === "execute") {
      params.simulate = false;
      params.idempotency_key = body.idempotencyKey ?? `tradi-${Date.now()}`;
      const result = await keeperhubCall("execute_contract_call", params);
      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
