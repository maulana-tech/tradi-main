import { NextRequest, NextResponse } from "next/server";

const KEEPERHUB_MCP_URL = "https://app.keeperhub.com/mcp";
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY ?? "";

async function keeperhubCall(toolName: string, args: Record<string, unknown>) {
  if (!KEEPERHUB_API_KEY) {
    throw new Error("KEEPERHUB_API_KEY not configured");
  }

  const response = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEEPERHUB_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KeeperHub ${response.status}: ${text}`);
  }

  const body = (await response.json()) as {
    result?: { content?: Array<{ type: string; text: string }> };
    error?: { message: string };
  };

  if (body.error) throw new Error(`KeeperHub: ${body.error.message}`);

  const text = body.result?.content?.[0]?.text;
  if (!text) throw new Error("KeeperHub returned empty response");

  return JSON.parse(text);
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  try {
    if (action === "chains") {
      const result = await keeperhubCall("list_action_schemas", {});
      return NextResponse.json({ ok: true, data: result });
    }

    if (action === "wallet") {
      const result = await keeperhubCall("get_wallet_integration", {});
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
      target: string;
      calldata: string;
      idempotencyKey?: string;
    };

    if (body.action === "simulate") {
      const result = await keeperhubCall("execute_contract_call", {
        target: body.target,
        calldata: body.calldata,
        simulate: true,
      });
      return NextResponse.json({ ok: true, data: result });
    }

    if (body.action === "execute") {
      const result = await keeperhubCall("execute_contract_call", {
        target: body.target,
        calldata: body.calldata,
        simulate: false,
        idempotencyKey: body.idempotencyKey ?? `tradi-${Date.now()}`,
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
