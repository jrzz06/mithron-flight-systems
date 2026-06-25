import { AdminFrame } from "@/components/admin/admin-frame";
import { AdminShell } from "@/components/admin/admin-shell";
import { assertRouteAccessOrRedirect } from "@/services/auth";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const context = await assertRouteAccessOrRedirect("/operations");

  return (
    <Suspense fallback={<AdminFrame role={context.role} userId={context.userId} pendingSupplierApprovals={0}>{children}</AdminFrame>}>
      <AdminShell role={context.role!} userId={context.userId}>
        {children}
      </AdminShell>
    </Suspense>
  );
}
