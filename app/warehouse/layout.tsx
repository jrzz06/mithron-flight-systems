import { WarehouseFrame } from "@/components/warehouse/warehouse-frame";
import { canAccessProtectedPath, defaultPathForRole } from "@/lib/auth/access-control";
import { getCurrentAuthContext } from "@/services/auth";
import { recordSecurityEvent } from "@/services/security-observability";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAuthContext();

  if (!canAccessProtectedPath(context.role, "/warehouse")) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.route_denied",
      attemptedResource: "/warehouse",
      denialReason: `Role ${context.role ?? "anonymous"} cannot render the warehouse workspace.`,
      routePath: "/warehouse",
      httpStatus: context.userId ? 403 : 401,
      severity: "warning",
      source: "warehouse-layout",
      metadata: {
        claims_role: context.claimsRole,
        boundary: "warehouse_panel"
      }
    }).catch((error) => console.error("[mithron-security] Failed to log warehouse shell denial.", error));
    redirect(defaultPathForRole(context.role));
  }

  return <WarehouseFrame>{children}</WarehouseFrame>;
}
