const STATUS_LABELS: Record<string, string> = {
  live: "All systems ready",
  partial: "Some data unavailable",
  blocked: "Temporarily unavailable",
  pending: "Awaiting review",
  pending_review: "Awaiting review",
  draft: "Draft",
  published: "Published",
  processing: "In progress",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  open: "Open",
  closed: "Closed",
  unread: "Unread",
  read: "Read",
  success: "Complete",
  error: "Failed",
  warning: "Needs attention",
  create: "",
  rbac: "",
  cms: "",
  media: "",
  orders: "",
  protected: ""
};

const EMPTY_MESSAGES: Record<string, string> = {
  orders: "No orders yet. New orders will appear here.",
  products: "No products found. Create your first product to get started.",
  inventory: "Inventory is clear. No low-stock items right now.",
  activity: "No recent activity to show.",
  notifications: "You're all caught up.",
  media: "No media assets yet. Upload files to build your library.",
  suppliers: "No supplier accounts yet.",
  enquiries: "No enquiries in the queue.",
  default: "Nothing to show yet."
};

export function humanStatus(status: string): string {
  const normalized = status.toLowerCase().trim();
  if (STATUS_LABELS[normalized] !== undefined) return STATUS_LABELS[normalized];
  return status.replaceAll("_", " ");
}

export function snapshotStatusLabel(status: "LIVE" | "PARTIAL" | "BLOCKED" | string): string {
  const normalized = status.toUpperCase();
  if (normalized === "LIVE") return "All systems ready";
  if (normalized === "PARTIAL") return "Some data unavailable";
  if (normalized === "BLOCKED") return "Temporarily unavailable";
  return humanStatus(status);
}

export function connectivityMessage(blockedReason?: string | null): string {
  if (!blockedReason) return "";
  if (/table|mithron_|supabase|env|missing/i.test(blockedReason)) {
    return "We couldn't load this data. Check your connection or contact support.";
  }
  return blockedReason;
}

export function emptyMessage(context: string): string {
  return EMPTY_MESSAGES[context] ?? EMPTY_MESSAGES.default;
}

export function relativeTimeLabel(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
