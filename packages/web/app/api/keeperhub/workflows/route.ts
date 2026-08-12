import { NextRequest, NextResponse } from "next/server";

const KEEPERHUB_MCP_URL = "https://app.keeperhub.com/mcp";
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY ?? "";

let cachedSessionId: string | null = null;
let sessionExpiresAt = 0;

async function getMcpSessionId(): Promise<string> {
  if (cachedSessionId && Date.now() < sessionExpiresAt) return cachedSessionId;

  const initRes = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEEPERHUB_API_KEY}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "tradi", version: "1.0.0" } } }),
  });

  if (!initRes.ok) throw new Error(`KeeperHub init failed: ${initRes.status}`);
  const sessionId = initRes.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("No session ID");

  await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEEPERHUB_API_KEY}`, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  cachedSessionId = sessionId;
  sessionExpiresAt = Date.now() + 55 * 60 * 1000;
  return sessionId;
}

async function mcpCall(toolName: string, args: Record<string, unknown>) {
  if (!KEEPERHUB_API_KEY) throw new Error("KEEPERHUB_API_KEY not configured");
  const sessionId = await getMcpSessionId();

  const response = await fetch(KEEPERHUB_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEEPERHUB_API_KEY}`, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) { cachedSessionId = null; sessionExpiresAt = 0; }
    throw new Error(`KeeperHub ${response.status}: ${await response.text()}`);
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

  try {
    // List all workflows
    if (action === "list") {
      const result = await mcpCall("list_workflows", {});
      return NextResponse.json({ ok: true, data: result });
    }

    // Get single workflow
    if (action === "get") {
      const workflowId = request.nextUrl.searchParams.get("workflowId");
      if (!workflowId) return NextResponse.json({ error: "workflowId required" }, { status: 400 });
      const result = await mcpCall("get_workflow", { workflowId });
      return NextResponse.json({ ok: true, data: result });
    }

    // List executions for a workflow
    if (action === "executions") {
      const workflowId = request.nextUrl.searchParams.get("workflowId");
      const limit = request.nextUrl.searchParams.get("limit") ?? "20";
      const result = await mcpCall("list_executions", { workflowId: workflowId ?? undefined, limit: parseInt(limit) });
      return NextResponse.json({ ok: true, data: result });
    }

    // Get execution details + logs
    if (action === "execution") {
      const executionId = request.nextUrl.searchParams.get("executionId");
      if (!executionId) return NextResponse.json({ error: "executionId required" }, { status: 400 });
      const result = await mcpCall("get_execution", { executionId });
      return NextResponse.json({ ok: true, data: result });
    }

    // Get execution logs only
    if (action === "logs") {
      const executionId = request.nextUrl.searchParams.get("executionId");
      if (!executionId) return NextResponse.json({ error: "executionId required" }, { status: 400 });
      const result = await mcpCall("get_execution_logs", { executionId });
      return NextResponse.json({ ok: true, data: result });
    }

    // Get execution status
    if (action === "status") {
      const executionId = request.nextUrl.searchParams.get("executionId");
      if (!executionId) return NextResponse.json({ error: "executionId required" }, { status: 400 });
      const result = await mcpCall("get_execution_status", { executionId });
      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "create" | "execute" | "delete";
      name?: string;
      description?: string;
      workflowId?: string;
      nodes?: unknown[];
      edges?: unknown[];
    };

    // Create a workflow
    if (body.action === "create") {
      if (!body.name || !body.nodes) {
        return NextResponse.json({ error: "name and nodes required" }, { status: 400 });
      }
      const result = await mcpCall("create_workflow", {
        name: body.name,
        description: body.description ?? "",
        nodes: body.nodes,
        edges: body.edges ?? [],
        enabled: true,
        idempotency_key: `tradi-${body.name}-${Date.now()}`,
      });

      // Trigger immediate first execution
      const workflowId = (result as Record<string, unknown>)?.id as string;
      if (workflowId) {
        try {
          await mcpCall("execute_workflow", { workflowId });
        } catch {
          // Silent — execution may fail but workflow is created
        }
      }

      return NextResponse.json({ ok: true, data: result });
    }

    // Execute a workflow
    if (body.action === "execute") {
      if (!body.workflowId) return NextResponse.json({ error: "workflowId required" }, { status: 400 });
      const result = await mcpCall("execute_workflow", { workflowId: body.workflowId });
      return NextResponse.json({ ok: true, data: result });
    }

    // Delete a workflow
    if (body.action === "delete") {
      if (!body.workflowId) return NextResponse.json({ error: "workflowId required" }, { status: 400 });
      const result = await mcpCall("delete_workflow", { workflowId: body.workflowId });
      return NextResponse.json({ ok: true, data: result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
