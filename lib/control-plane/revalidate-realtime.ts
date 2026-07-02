"use server";

import { revalidatePath, revalidateTag } from "next/cache";

const TABLE_REVALIDATION: Record<string, { tags: string[]; paths: string[] }> = {
  orders: {
    tags: ["admin-dashboard", "control-plane-orders"],
    paths: ["/admin", "/admin/orders", "/warehouse/dashboard", "/warehouse/orders"]
  },
  order_items: {
    tags: ["admin-dashboard", "control-plane-orders"],
    paths: ["/admin/orders", "/warehouse/orders"]
  },
  inventory: {
    tags: ["admin-dashboard", "control-plane-inventory"],
    paths: ["/admin", "/admin/inventory", "/warehouse/dashboard", "/warehouse/inventory"]
  },
  inventory_movements: {
    tags: ["control-plane-inventory"],
    paths: ["/admin/inventory", "/warehouse/inventory", "/warehouse/movements"]
  },
  warehouse_stock: {
    tags: ["control-plane-warehouse", "control-plane-inventory"],
    paths: ["/warehouse/dashboard", "/warehouse/inventory"]
  },
  mithron_products: {
    tags: ["admin-dashboard", "control-plane-catalog"],
    paths: ["/admin", "/admin/products", "/supplier"]
  },
  enquiries: {
    tags: ["admin-dashboard", "control-plane-enquiries"],
    paths: ["/admin", "/admin/enquiries"]
  },
  contact_requests: {
    tags: ["admin-dashboard", "control-plane-enquiries"],
    paths: ["/admin/enquiries"]
  },
  notifications: {
    tags: ["admin-dashboard", "control-plane-notifications"],
    paths: ["/admin", "/warehouse/dashboard", "/supplier"]
  },
  activity_logs: {
    tags: ["admin-dashboard", "control-plane-activity"],
    paths: ["/admin", "/warehouse/activity"]
  },
  shipments: {
    tags: ["control-plane-warehouse"],
    paths: ["/warehouse/dashboard", "/warehouse/shipments"]
  }
};

export async function revalidateControlPlaneRealtime(table: string) {
  const config = TABLE_REVALIDATION[table] ?? {
    tags: ["admin-dashboard"],
    paths: ["/admin"]
  };

  for (const tag of config.tags) {
    revalidateTag(tag, "max");
  }
  for (const path of config.paths) {
    revalidatePath(path);
  }
}
