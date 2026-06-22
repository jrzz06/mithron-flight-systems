"use client";

import { PlatformShell } from "@/components/platform/platform-shell";
import { warehouseNavGroups, warehouseRouteTitles } from "@/components/platform/nav-config";

export function WarehouseFrame({ children }: { children: React.ReactNode }) {
  return (
    <PlatformShell
      scope="warehouse"
      groups={warehouseNavGroups}
      routeTitles={warehouseRouteTitles}
      searchItems={warehouseNavGroups.flatMap((group) => group.items.map((item) => ({ label: item.label, href: item.href, group: group.label })))}
      scopeBadge="Warehouse"
      accentClass="bg-teal-50 text-teal-900"
      shellDataAttributes={{ "data-warehouse-frame": true }}
      primaryAction={{ label: "New order", href: "/warehouse/orders#create-order" }}
      notificationHref="/warehouse/orders"
      showTopbar
    >
      {children}
    </PlatformShell>
  );
}
