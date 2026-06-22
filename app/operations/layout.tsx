import { defaultPathForRole, isStrictAdminRole } from "@/lib/auth/access-control";
import { AdminFrame } from "@/components/admin/admin-frame";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentAuthContext } from "@/services/auth";
import { recordSecurityEvent } from "@/services/security-observability";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAuthContext();

  if (!isStrictAdminRole(context.role)) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.route_denied",
      attemptedResource: "/operations",
      denialReason: `Role ${context.role ?? "anonymous"} cannot render the operations workspace.`,
      routePath: "/operations",
      httpStatus: context.userId ? 403 : 401,
      severity: "warning",
      source: "operations-layout",
      metadata: { boundary: "operations_panel" }
    }).catch((error) => console.error("[mithron-security] Failed to log operations shell denial.", error));
    redirect(defaultPathForRole(context.role));
  }

  return (
    <Suspense fallback={<AdminFrame role={context.role} userId={context.userId} pendingSupplierApprovals={0}>{children}</AdminFrame>}>
      <AdminShell role={context.role!} userId={context.userId}>
        {children}
      </AdminShell>
    </Suspense>
  );
}
