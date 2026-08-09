import { NextRequest, NextResponse } from "next/server";

export interface AuditRecord {
  intentId: string;
  action: string;
  decision: string;
  reason: string;
  executionId: string | null;
  status: "simulating" | "submitted" | "confirming" | "success" | "failed";
  transactionHash: string | null;
  transactionLink: string | null;
  gasUsed: string | null;
  sponsored: boolean | null;
  routedVia: "keeperhub" | "viem-fallback";
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

// In-memory store. For production, replace with KV/DB.
// Persists across hot-reloads in dev via global.
const globalForAudit = globalThis as unknown as {
  auditStore: Map<string, AuditRecord> | undefined;
};

const store: Map<string, AuditRecord> =
  globalForAudit.auditStore ?? new Map();
globalForAudit.auditStore = store;

export function getAuditByIntent(intentId: string): AuditRecord | null {
  return store.get(intentId) ?? null;
}

export function setAudit(record: AuditRecord): void {
  store.set(record.intentId, record);
}

export async function GET(request: NextRequest) {
  const intentId = request.nextUrl.searchParams.get("intentId");
  if (!intentId) {
    return NextResponse.json(
      { error: "intentId query parameter required" },
      { status: 400 }
    );
  }

  const record = store.get(intentId);
  if (!record) {
    return NextResponse.json({ found: false, record: null });
  }

  return NextResponse.json({ found: true, record });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AuditRecord;

  if (!body.intentId) {
    return NextResponse.json(
      { error: "intentId required" },
      { status: 400 }
    );
  }

  store.set(body.intentId, body);

  return NextResponse.json({ ok: true, stored: body.intentId });
}
