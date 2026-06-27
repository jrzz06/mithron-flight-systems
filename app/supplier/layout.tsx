import { Suspense } from "react";
import { SupplierFrame } from "@/components/supplier/supplier-frame";
import { ControlPlaneLoading } from "@/components/ui/control-plane-loading";
import { assertRouteAccessOrRedirect } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const context = await assertRouteAccessOrRedirect("/supplier");
  return (
    <Suspense fallback={<ControlPlaneLoading />}>
      <SupplierFrame recipientId={context.userId ?? undefined} role={context.role}>
        {children}
      </SupplierFrame>
    </Suspense>
  );
}
