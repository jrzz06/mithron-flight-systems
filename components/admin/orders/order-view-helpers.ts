import { formatINR } from "@/lib/utils";
import {
  isOrderArchived,
  isOrderDeleted,
  matchesAdminOrderQueue,
  type AdminOrderQueue
} from "@/lib/orders/lifecycle";

export type AdminRow = Record<string, unknown>;

export type OrderSortKey =
  | "newest"
  | "oldest"
  | "total_desc"
  | "customer_asc"
  | "needs_action";

export type OrderFilterState = {
  query: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  warehouse: string;
  dateFrom: string;
  dateTo: string;
  customer: string;
  product: string;
  orderId: string;
  sort: OrderSortKey;
};

export const LIFECYCLE_STATES = [
  "pending",
  "processing",
  "picked",
  "packed",
  "ready_to_dispatch",
  "shipped",
  "delivered",
  "returned",
  "cancelled"
] as const;

export function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function numberText(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

export function moneyText(value: unknown) {
  const parsed = Number(value ?? 0);
  return formatINR(Number.isFinite(parsed) ? parsed : 0);
}

export function publicOrderLabel(order: AdminRow) {
  return text(order.order_number) || text(order.id).slice(0, 8) || "Order";
}

export function orderMetadata(order: AdminRow) {
  const metadata = order.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

export function orderPhone(order: AdminRow) {
  return text(orderMetadata(order).customer_phone);
}

export function customerName(order: AdminRow) {
  return text(orderMetadata(order).customer_full_name) || text(order.customer_email, "Guest");
}

export function assignedWarehouseCode(order: AdminRow, fallback: string) {
  return text(orderMetadata(order).assigned_warehouse_code, fallback);
}

export function orderDateTime(order: AdminRow) {
  const { date, time } = orderDateParts(order);
  if (date === "—") return "—";
  return time === "—" ? date : `${date} · ${time}`;
}

export function orderDateParts(order: AdminRow) {
  const raw = text(order.created_at) || text(order.updated_at);
  if (!raw) return { date: "—", time: "—" };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = raw.slice(0, 16).replace("T", " ");
    const [date = fallback, time = "—"] = fallback.split(" ");
    return { date, time };
  }
  return {
    date: parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }),
    time: parsed.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };
}

export function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: "Awaiting payment",
    paid: "Paid",
    admin_review: "In review",
    confirmed: "Confirmed",
    assigned: "Assigned",
    processing: "Processing",
    cancelled: "Cancelled"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function buildOrdersUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export function orderMatchesQueue(order: AdminRow, queue: string) {
  return matchesAdminOrderQueue(order, (queue as AdminOrderQueue) || "active");
}

export type PriorityBadge = "urgent" | "action" | "payment" | null;

export function orderPriorityBadge(order: AdminRow): PriorityBadge {
  const status = text(order.status);
  const channel = text(order.channel, "checkout");
  if (status === "pending_payment") return "payment";
  if (matchesAdminOrderQueue(order, "pending_verification")) return "action";
  if (channel === "enquiry" && ["paid", "admin_review"].includes(status)) return "urgent";
  return null;
}

export function orderNeedsAction(order: AdminRow) {
  return matchesAdminOrderQueue(order, "pending_verification");
}

export function orderItemsForOrder(orderId: string, orderItems: AdminRow[]) {
  return orderItems.filter((item) => text(item.order_id) === orderId);
}

export function productSummaryLine(orderId: string, orderItems: AdminRow[]) {
  const items = orderItemsForOrder(orderId, orderItems);
  if (!items.length) return { primary: "—", extra: 0 };
  const primary = items[0];
  const name = text(primary.product_name, text(primary.product_slug, "Item"));
  const qty = numberText(primary.quantity);
  return {
    primary: `${name} ×${qty}`,
    extra: Math.max(0, items.length - 1)
  };
}

export function resolveProductImage(products: AdminRow[], productSlug: string) {
  const product = products.find((row) => text(row.slug) === productSlug);
  if (!product) return null;
  const image = text(product.image) || text(product.hero);
  return image || null;
}

export function orderSearchHaystack(
  order: AdminRow,
  orderItems: AdminRow[]
) {
  const items = orderItemsForOrder(text(order.id), orderItems);
  const itemText = items
    .map((item) => `${text(item.product_name)} ${text(item.product_slug)} ${text(item.sku)}`)
    .join(" ");
  return [
    publicOrderLabel(order),
    text(order.id),
    text(order.customer_email),
    customerName(order),
    orderPhone(order),
    itemText
  ]
    .join(" ")
    .toLowerCase();
}

export function filterOrders(
  orders: AdminRow[],
  orderItems: AdminRow[],
  queue: string,
  filters: OrderFilterState,
  defaultWarehouse: string
) {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return orders.filter((order) => {
    if (!orderMatchesQueue(order, queue)) return false;

    if (normalizedQuery && !orderSearchHaystack(order, orderItems).includes(normalizedQuery)) {
      return false;
    }

    if (filters.paymentStatus && text(order.payment_status) !== filters.paymentStatus) return false;
    if (filters.fulfillmentStatus && text(order.fulfillment_status, "pending") !== filters.fulfillmentStatus) {
      return false;
    }
    if (filters.warehouse) {
      const wh = assignedWarehouseCode(order, defaultWarehouse);
      if (wh !== filters.warehouse) return false;
    }
    if (filters.customer) {
      const email = text(order.customer_email).toLowerCase();
      if (!email.includes(filters.customer.trim().toLowerCase())) return false;
    }
    if (filters.orderId) {
      const idHaystack = `${publicOrderLabel(order)} ${text(order.id)}`.toLowerCase();
      if (!idHaystack.includes(filters.orderId.trim().toLowerCase())) return false;
    }
    if (filters.product) {
      const slug = filters.product.trim().toLowerCase();
      const items = orderItemsForOrder(text(order.id), orderItems);
      const hasProduct = items.some(
        (item) =>
          text(item.product_slug).toLowerCase().includes(slug) ||
          text(item.product_name).toLowerCase().includes(slug)
      );
      if (!hasProduct) return false;
    }
    if (filters.dateFrom || filters.dateTo) {
      const created = text(order.created_at);
      if (created) {
        const day = created.slice(0, 10);
        if (filters.dateFrom && day < filters.dateFrom) return false;
        if (filters.dateTo && day > filters.dateTo) return false;
      }
    }

    return true;
  });
}

export function sortOrders(orders: AdminRow[], sort: OrderSortKey) {
  const copy = [...orders];
  copy.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return text(a.created_at).localeCompare(text(b.created_at));
      case "total_desc":
        return Number(b.total ?? 0) - Number(a.total ?? 0);
      case "customer_asc":
        return customerName(a).localeCompare(customerName(b));
      case "needs_action": {
        const aAction = orderNeedsAction(a) ? 0 : 1;
        const bAction = orderNeedsAction(b) ? 0 : 1;
        if (aAction !== bAction) return aAction - bAction;
        return text(b.created_at).localeCompare(text(a.created_at));
      }
      case "newest":
      default:
        return text(b.created_at).localeCompare(text(a.created_at));
    }
  });
  return copy;
}

export function fullOrderTimeline(order: AdminRow) {
  if (!Array.isArray(order.timeline)) return [] as AdminRow[];
  return [...(order.timeline as AdminRow[])].reverse();
}

export function priorOrdersForCustomer(
  order: AdminRow,
  allOrders: AdminRow[],
  limit = 5
) {
  const email = text(order.customer_email).toLowerCase();
  if (!email) return [];
  const orderId = text(order.id);
  return allOrders
    .filter((row) => text(row.id) !== orderId && text(row.customer_email).toLowerCase() === email)
    .slice(0, limit);
}

export function nextStepForOrder(order: AdminRow) {
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");

  if (status === "paid") {
    return {
      title: "Verify order",
      description: "Payment is complete. Verify customer details, then move this order into admin review.",
      action: "confirm" as const,
      button: "Verify"
    };
  }
  if (status === "admin_review") {
    return {
      title: "Approve order",
      description: "Approve the order after verifying contact details, items, and any enquiry notes.",
      action: "confirm" as const,
      button: "Approve"
    };
  }
  if (status === "confirmed" && fulfillment === "pending") {
    return {
      title: "Send to warehouse",
      description: "Order is verified. Assign it to warehouse so picking and packing can begin.",
      action: "assign" as const,
      button: "Send to Warehouse"
    };
  }
  if (status === "assigned" || fulfillment === "processing") {
    return {
      title: "Track fulfillment",
      description: "Warehouse is working on this order. Update fulfillment status or create a shipment when ready.",
      action: "fulfillment" as const,
      button: ""
    };
  }
  if (status === "pending_payment") {
    return {
      title: "Awaiting customer payment",
      description: "This order is not paid yet. No admin action is required until payment succeeds.",
      action: "none" as const,
      button: ""
    };
  }
  return {
    title: "No action required",
    description: "This order is moving through fulfillment or already completed.",
    action: "none" as const,
    button: ""
  };
}

export {
  isOrderArchived,
  isOrderDeleted
} from "@/lib/orders/lifecycle";

export function canCancelOrder(order: AdminRow | null) {
  if (!order) return false;
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");
  const terminal = ["cancelled", "delivered", "returned"];
  return !terminal.includes(status) && !terminal.includes(fulfillment);
}

export function canDeleteOrder(order: AdminRow | null) {
  if (!order || isOrderDeleted(order)) return false;
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");
  const channel = text(order.channel, "checkout");
  const activeFulfillment = ["processing", "picked", "packed", "ready_to_dispatch", "shipped", "delivered", "assigned"];
  if (activeFulfillment.includes(fulfillment)) return false;
  if (["assigned", "processing", "packed", "dispatched", "delivered", "confirmed"].includes(status)) return false;
  return ["draft", "pending_payment", "admin_review", "cancelled"].includes(status) || channel === "enquiry";
}

export function canArchiveOrder(order: AdminRow | null) {
  if (!order || isOrderDeleted(order) || isOrderArchived(order)) return false;
  return !["cancelled", "delivered", "refunded"].includes(text(order.status, "pending"));
}

export function canRestoreOrder(order: AdminRow | null) {
  return Boolean(order && (isOrderDeleted(order) || isOrderArchived(order)));
}

export function canPermanentlyDeleteOrder(order: AdminRow | null) {
  return Boolean(order && isOrderDeleted(order));
}

export function parseOrderFiltersFromSearchParams(params: URLSearchParams): OrderFilterState {
  return {
    query: params.get("q") ?? "",
    paymentStatus: params.get("payment_status") ?? "",
    fulfillmentStatus: params.get("fulfillment_status") ?? "",
    warehouse: params.get("warehouse") ?? "",
    dateFrom: params.get("date_from") ?? "",
    dateTo: params.get("date_to") ?? "",
    customer: params.get("customer") ?? "",
    product: params.get("product") ?? "",
    orderId: params.get("order_id_filter") ?? "",
    sort: (params.get("sort") as OrderSortKey) || "newest"
  };
}

export function filtersToSearchParams(
  base: URLSearchParams,
  filters: OrderFilterState,
  extras: { queue?: string; order?: string; tool?: string }
) {
  const next = new URLSearchParams(base.toString());
  const setOrDelete = (key: string, value: string) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete("q", filters.query);
  setOrDelete("payment_status", filters.paymentStatus);
  setOrDelete("fulfillment_status", filters.fulfillmentStatus);
  setOrDelete("warehouse", filters.warehouse);
  setOrDelete("date_from", filters.dateFrom);
  setOrDelete("date_to", filters.dateTo);
  setOrDelete("customer", filters.customer);
  setOrDelete("product", filters.product);
  setOrDelete("order_id_filter", filters.orderId);
  if (filters.sort && filters.sort !== "newest") next.set("sort", filters.sort);
  else next.delete("sort");
  if (extras.queue) next.set("queue", extras.queue);
  else next.delete("queue");
  if (extras.order) next.set("order", extras.order);
  else next.delete("order");
  if (extras.tool) next.set("tool", extras.tool);
  else next.delete("tool");
  return next;
}
