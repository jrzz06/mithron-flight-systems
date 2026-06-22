"use client";

import { OperatorToastBridge } from "@/components/admin/operator-toast-bridge";
import { PlatformShell } from "@/components/platform/platform-shell";
import { supplierNavGroups, supplierRouteTitles } from "@/components/platform/nav-config";
import { SupplierFeedbackDialog } from "@/components/supplier/supplier-feedback-dialog";

export function SupplierFrame({ children, recipientId }: { children: React.ReactNode; recipientId?: string }) {
  return (
    <>
      <OperatorToastBridge />
      <SupplierFeedbackDialog />
      <PlatformShell
        scope="supplier"
        groups={supplierNavGroups}
        routeTitles={supplierRouteTitles}
        searchItems={supplierNavGroups.flatMap((group) => group.items.map((item) => ({ label: item.label, href: item.href, group: group.label })))}
        userId={recipientId}
        scopeBadge="Supplier"
        accentClass="bg-violet-50 text-violet-900"
        shellDataAttributes={{ "data-supplier-frame": true }}
        primaryAction={{ label: "Add product", href: "/supplier/products/new" }}
        notificationHref="/supplier"
      >
        {children}
      </PlatformShell>
    </>
  );
}
