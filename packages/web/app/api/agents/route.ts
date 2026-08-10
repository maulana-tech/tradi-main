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
  const agent: DeployedAgent = {
    id,
    strategyId: body.strategyId,
    name: body.name ?? `Agent ${store.size + 1}`,
    status: "deploying",
    writerMode: body.writerMode ?? "agent",
    deployedAt: new Date().toISOString(),
    lastRun: null,
    runs: 0,
    errors: 0,
    config: body.config ?? {},
  };

  store.set(id, agent);

  // Simulate deployment delay
  setTimeout(() => {
    const a = store.get(id);
    if (a) {
      a.status = "running";
      store.set(id, a);
    }
  }, 2000);

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
    return NextResponse.json({ ok: true, deleted: body.id });
  }

  if (body.action === "start") {
    agent.status = "running";
    agent.lastRun = new Date().toISOString();
  } else if (body.action === "stop") {
    agent.status = "stopped";
  }

  store.set(body.id, agent);
  return NextResponse.json({ ok: true, agent });
}
