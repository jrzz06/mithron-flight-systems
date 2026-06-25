"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEnterpriseRealtime } from "@/hooks/use-enterprise-realtime";
import type { EnterpriseRealtimeScope } from "@/services/enterprise-realtime";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  status: string;
  created_at?: string;
};

type NotificationBellProps = {
  href?: string;
  recipientId: string;
  pollIntervalMs?: number;
  realtimeScope?: EnterpriseRealtimeScope;
};

function NotificationBellRealtimeSync({
  scope,
  onRefresh
}: {
  scope: EnterpriseRealtimeScope;
  onRefresh: () => void;
}) {
  const { diagnostics } = useEnterpriseRealtime(scope, { refreshOnEvent: true });
  const lastEventAt = useRef<string | null>(null);

  useEffect(() => {
    if (!diagnostics.lastEventAt || diagnostics.lastEventAt === lastEventAt.current) return;
    lastEventAt.current = diagnostics.lastEventAt;
    onRefresh();
  }, [diagnostics.lastEventAt, diagnostics.receivedEvents, onRefresh]);

  return null;
}

export function NotificationBell({
  href = "/account",
  recipientId,
  pollIntervalMs = 30_000,
  realtimeScope
}: NotificationBellProps) {
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const refreshNotifications = useCallback(() => {
    fetch(`/api/notifications?recipient=${encodeURIComponent(recipientId)}`)
      .then((response) => (response.ok ? response.json() : { notifications: [] }))
      .then((payload) => {
        setRows(Array.isArray(payload.notifications) ? payload.notifications : []);
      })
      .catch(() => undefined);
  }, [recipientId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch(`/api/notifications?recipient=${encodeURIComponent(recipientId)}`, {
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : { notifications: [] }))
      .then((payload) => {
        if (!active) return;
        setRows(Array.isArray(payload.notifications) ? payload.notifications : []);
      })
      .catch(() => undefined);

    const interval = window.setInterval(() => {
      if (!active) return;
      refreshNotifications();
    }, pollIntervalMs);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [pollIntervalMs, recipientId, refreshNotifications]);

  const unread = rows.filter((row) => row.status === "unread").length;

  return (
    <>
      {realtimeScope ? <NotificationBellRealtimeSync scope={realtimeScope} onRefresh={refreshNotifications} /> : null}
      <Link
        href={href}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        data-notification-bell
        className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-muted)] transition hover:bg-[var(--platform-surface-muted)] hover:text-[var(--platform-text-secondary)]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-[var(--platform-accent-soft)] px-1 text-[10px] font-medium text-[var(--platform-text-secondary)] ring-1 ring-[var(--platform-border-strong)]">
            {unread}
          </span>
        ) : null}
      </Link>
    </>
  );
}
