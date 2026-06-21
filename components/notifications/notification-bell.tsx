"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
};

export function NotificationBell({ href = "/account", recipientId }: NotificationBellProps) {
  const [rows, setRows] = useState<NotificationRow[]>([]);

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

    return () => {
      active = false;
      controller.abort();
    };
  }, [recipientId]);

  const unread = rows.filter((row) => row.status === "unread").length;

  return (
    <Link
      href={href}
      aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      data-notification-bell
      className="relative inline-flex size-10 items-center justify-center rounded-full border border-white/10 text-slate-200 transition hover:bg-white/5"
    >
      <Bell className="size-[18px]" />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
          {unread}
        </span>
      ) : null}
    </Link>
  );
}
