import { NextRequest, NextResponse } from "next/server";

export type NotificationType = "success" | "error" | "warning" | "info";
export type NotificationSource = "agent" | "keeperhub" | "settlement" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  source: NotificationSource;
  title: string;
  message: string;
  agentId?: string;
  executionId?: string;
  txHash?: string;
  txLink?: string;
  read: boolean;
  createdAt: string;
}

const globalForNotifications = globalThis as unknown as {
  notifStore: Notification[] | undefined;
};

const store: Notification[] = globalForNotifications.notifStore ?? [];
globalForNotifications.notifStore = store;

function addNotification(notif: Omit<Notification, "id" | "read" | "createdAt">) {
  store.unshift({
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (store.length > 100) store.length = 100;
}

// Seed some demo notifications if empty
if (store.length === 0) {
  addNotification({
    type: "info",
    source: "system",
    title: "Welcome to Tradi",
    message: "Your trading platform is ready. Browse strategies to deploy your first agent.",
  });
  addNotification({
    type: "success",
    source: "agent",
    title: "Market Maker deployed",
    message: "RFQ Market Maker agent is running on Arbitrum Sepolia.",
    agentId: "mm-default",
  });
}

export async function GET() {
  return NextResponse.json({ notifications: store, total: store.length });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Omit<Notification, "id" | "read" | "createdAt">;

  if (!body.title || !body.message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }

  addNotification(body);
  return NextResponse.json({ ok: true, notification: store[0] });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { id?: string; action: "read" | "read-all" };

  if (body.action === "read-all") {
    for (const n of store) n.read = true;
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const notif = store.find((n) => n.id === body.id);
    if (notif) notif.read = true;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "id or action required" }, { status: 400 });
}
