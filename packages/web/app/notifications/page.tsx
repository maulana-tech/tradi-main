"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";

type NotificationType = "success" | "error" | "warning" | "info";
type NotificationSource = "agent" | "keeperhub" | "settlement" | "system";

interface Notification {
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

const TYPE_ICON: Record<NotificationType, string> = {
  success: "check_circle",
  error: "error",
  warning: "warning",
  info: "info",
};

const TYPE_TONE: Record<NotificationType, "success" | "danger" | "warning" | "primary"> = {
  success: "success",
  error: "danger",
  warning: "warning",
  info: "primary",
};

const SOURCE_LABEL: Record<NotificationSource, string> = {
  agent: "Agent",
  keeperhub: "KeeperHub",
  settlement: "Settlement",
  system: "System",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationType | "all">("all");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as { notifications: Notification[] };
      setNotifications(data.notifications);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read-all" }),
      });
      void fetchNotifications();
    } catch {
      // silent
    }
  }

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <AppShell>
      <PageHeader
        icon="notifications"
        title="Notifications"
        subtitle="Alerts from your agents, KeeperHub executions, and settlements."
        action={
          unread > 0 ? (
            <Button tone="secondary" onClick={markAllRead}>
              Mark all read ({unread})
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "success", "error", "warning", "info"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === t
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-white"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-20 animate-pulse p-5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Icon name="notifications_none" className="mx-auto size-10 text-[var(--color-text-muted)]" />
          <p className="mt-4 text-[var(--color-text-secondary)]">No notifications.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => (
            <Card
              key={notif.id}
              className={`p-4 transition ${notif.read ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-${TYPE_TONE[notif.type]}-soft)]`}
                >
                  <Icon
                    name={TYPE_ICON[notif.type]}
                    className={`size-4 text-[var(--color-${TYPE_TONE[notif.type]}-text)]`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{notif.title}</h3>
                    <Badge tone="neutral">{SOURCE_LABEL[notif.source]}</Badge>
                    {!notif.read && (
                      <span className="size-1.5 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{notif.message}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span>
                      {new Date(notif.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {notif.agentId && <span>Agent: {notif.agentId}</span>}
                    {notif.txLink && (
                      <a
                        href={notif.txLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-primary-text)] hover:underline"
                      >
                        View transaction
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
