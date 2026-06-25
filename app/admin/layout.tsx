import { defaultPathForRole, isStrictAdminRole } from "@/lib/auth/access-control";
import { AdminFrame } from "@/components/admin/admin-frame";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentAuthContext } from "@/services/auth";
import { recordSecurityEvent } from "@/services/security-observability";
import { countProductsMissingInventoryRecords } from "@/services/csv-inventory-source";
import { repairMissingProductInventory } from "@/services/product-inventory-sync";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAuthContext();

  if (!isStrictAdminRole(context.role)) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.admin_shell_denied",
      attemptedResource: "/admin",
      denialReason: `Role ${context.role ?? "anonymous"} cannot render the admin shell.`,
      routePath: "/admin",
      httpStatus: context.userId ? 403 : 401,
      severity: "critical",
      source: "admin-layout",
      metadata: {
        claims_role: context.claimsRole,
        boundary: "strict_admin_shell"
      }
    }).catch((error) => console.error("[mithron-security] Failed to log admin shell denial.", error));
    redirect(defaultPathForRole(context.role));
  }

  const missingInventoryCount = await countProductsMissingInventoryRecords();
  if (missingInventoryCount > 0) {
    await repairMissingProductInventory(context.userId).catch((error) => {
      console.error("[mithron-inventory] Admin layout inventory repair failed.", error);
    });
  }

  return (
    <Suspense fallback={<AdminFrame role={context.role} userId={context.userId} pendingSupplierApprovals={0}>{children}</AdminFrame>}>
      <AdminShell role={context.role!} userId={context.userId}>
        {children}
      </AdminShell>
    </Suspense>
  );
}
