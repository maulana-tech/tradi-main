"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Icon } from "./Icon";
import { Badge } from "./ui/Badge";

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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as { notifications: Notification[] };
      setNotifications(data.notifications);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "read" }),
      });
      void fetchNotifications();
    } catch {
      // silent
    }
  }

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

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex size-10 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-white"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Icon name="notifications" className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--color-primary-text)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Icon name="notifications_none" className="mx-auto size-8 text-[var(--color-text-muted)]" />
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">No notifications</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => (
                <div
                  key={notif.id}
                  className={`border-b border-[var(--color-border)] px-4 py-3 transition last:border-b-0 ${
                    notif.read ? "opacity-60" : "bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      name={TYPE_ICON[notif.type]}
                      className={`mt-0.5 size-4 shrink-0 text-[var(--color-${TYPE_TONE[notif.type]}-text)]`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{notif.message}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {notif.txLink && (
                          <a
                            href={notif.txLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[var(--color-primary-text)] hover:underline"
                          >
                            View tx
                          </a>
                        )}
                        {!notif.read && (
                          <button
                            onClick={() => markRead(notif.id)}
                            className="text-[10px] text-[var(--color-text-muted)] hover:text-white"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[var(--color-border)] px-4 py-2 text-center">
            <Link
              href={"/notifications" as Route}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-[var(--color-primary-text)] hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
