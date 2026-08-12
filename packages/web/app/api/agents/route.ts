import { NextRequest, NextResponse } from "next/server";

export type AgentStatus = "running" | "stopped" | "error" | "deploying";
export type WriterMode = "hermes" | "agent" | "dry-run";

export interface DeployedAgent {
  id: string;
  strategyId: string;
  name: string;
  status: AgentStatus;
  writerMode: WriterMode;
  deployedAt: string;
  lastRun: string | null;
  runs: number;
  errors: number;
  config: Record<string, string>;
  keeperhubWorkflowId?: string;
}

// In-memory store (global for hot-reload persistence in dev)
const globalForAgents = globalThis as unknown as {
  agentStore: Map<string, DeployedAgent> | undefined;
};

const store: Map<string, DeployedAgent> =
  globalForAgents.agentStore ?? new Map();
globalForAgents.agentStore = store;

// Seed with default agents if empty
if (store.size === 0) {
  const defaults: DeployedAgent[] = [
    {
      id: "mm-default",
      strategyId: "rfq-market-maker",
      name: "Market Maker #1",
      status: "stopped",
      writerMode: "agent",
      deployedAt: new Date().toISOString(),
      lastRun: null,
      runs: 0,
      errors: 0,
      config: { spreadBps: "30", maxNotional: "50000000000", pairs: "cETH/cUSDC" },
    },
    {
      id: "sweep-default",
      strategyId: "rfq-sweeper",
      name: "RFQ Finalizer",
      status: "stopped",
      writerMode: "agent",
      deployedAt: new Date().toISOString(),
      lastRun: null,
      runs: 0,
      errors: 0,
      config: { scanInterval: "5", scanDepth: "50" },
    },
  ];
  for (const a of defaults) store.set(a.id, a);
}

async function pushNotification(notif: {
  type: "success" | "error" | "warning" | "info";
  source: "agent" | "keeperhub" | "settlement" | "system";
  title: string;
  message: string;
  agentId?: string;
}) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notif),
    });
  } catch {
    // silent — notification is best-effort
  }
}

export async function GET() {
  const agents = Array.from(store.values());
  return NextResponse.json({ agents, total: agents.length });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    strategyId: string;
    name?: string;
    config?: Record<string, string>;
    writerMode?: WriterMode;
  };

  if (!body.strategyId) {
    return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  }

  const id = `${body.strategyId}-${Date.now()}`;
  const agentName = body.name ?? `Agent ${store.size + 1}`;

  const agent: DeployedAgent = {
    id,
    strategyId: body.strategyId,
    name: agentName,
    status: "deploying",
    writerMode: body.writerMode ?? "agent",
    deployedAt: new Date().toISOString(),
    lastRun: null,
    runs: 0,
    errors: 0,
    config: body.config ?? {},
  };

  store.set(id, agent);

  // Push deployment notification
  await pushNotification({
    type: "info",
    source: "agent",
    title: `Deploying ${agentName}`,
    message: `Strategy "${body.strategyId}" is being deployed. Creating KeeperHub workflow...`,
    agentId: id,
  });

  // Create real KeeperHub workflow
  try {
    const { getWorkflowTemplate } = await import("@/lib/keeperhub-templates");
    const template = getWorkflowTemplate(body.strategyId, body.config ?? {});

    if (template) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      const wfRes = await fetch(`${baseUrl}/api/keeperhub/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: template.name,
          description: template.description,
          nodes: template.nodes,
          edges: template.edges,
        }),
      });
      const wfData = (await wfRes.json()) as { ok: boolean; data?: { id?: string } };

      const a = store.get(id);
      if (a) {
        if (wfData.ok && wfData.data?.id) {
          a.keeperhubWorkflowId = wfData.data.id;
          a.status = "running";
          store.set(id, a);

          await pushNotification({
            type: "success",
            source: "agent",
            title: `${agentName} deployed`,
            message: `KeeperHub workflow created: ${wfData.data.id}. Agent is now active.`,
            agentId: id,
          });
        } else {
          a.status = "running";
          store.set(id, a);

          await pushNotification({
            type: "warning",
            source: "agent",
            title: `${agentName} deployed (no workflow)`,
            message: "Agent deployed but KeeperHub workflow creation failed. Check KeeperHub config.",
            agentId: id,
          });
        }
      }
    } else {
      // No template for this strategy — just mark as running
      const a = store.get(id);
      if (a) {
        a.status = "running";
        store.set(id, a);
      }
    }
  } catch (err) {
    console.error("KeeperHub workflow creation failed:", err);
    const a = store.get(id);
    if (a) {
      a.status = "running";
      store.set(id, a);

      await pushNotification({
        type: "warning",
        source: "agent",
        title: `${agentName} deployed (workflow error)`,
        message: `Agent running but workflow creation error: ${err instanceof Error ? err.message : String(err)}`,
        agentId: id,
      });
    }
  }

  return NextResponse.json({ ok: true, agent });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    id: string;
    action: "start" | "stop" | "delete";
  };

  const agent = store.get(body.id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (body.action === "delete") {
    store.delete(body.id);
    await pushNotification({
      type: "warning",
      source: "agent",
      title: `${agent.name} removed`,
      message: "Agent has been deleted. KeeperHub workflow stopped.",
      agentId: body.id,
    });
    return NextResponse.json({ ok: true, deleted: body.id });
  }

  if (body.action === "start") {
    agent.status = "running";
    agent.lastRun = new Date().toISOString();
    agent.runs += 1;
    await pushNotification({
      type: "success",
      source: "agent",
      title: `${agent.name} started`,
      message: "Agent is now actively monitoring and executing.",
      agentId: body.id,
    });
  } else if (body.action === "stop") {
    agent.status = "stopped";
    await pushNotification({
      type: "warning",
      source: "agent",
      title: `${agent.name} stopped`,
      message: "Agent has been paused. No new executions will occur.",
      agentId: body.id,
    });
  }

  store.set(body.id, agent);
  return NextResponse.json({ ok: true, agent });
}
