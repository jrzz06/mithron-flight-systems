import { AdminFrame } from "@/components/admin/admin-frame";
import { defaultPathForRole, isStrictAdminRole } from "@/lib/auth/access-control";
import { getCurrentAuthContext } from "@/services/auth";
import { recordSecurityEvent } from "@/services/security-observability";
import { countPendingSupplierProducts } from "@/services/supplier-actions";
import { redirect } from "next/navigation";

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

  const pendingSupplierApprovals = await countPendingSupplierProducts();

  return (
    <AdminFrame role={context.role} userId={context.userId} pendingSupplierApprovals={pendingSupplierApprovals}>
      {children}
    </AdminFrame>
  );
}
