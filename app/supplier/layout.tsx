import { Suspense } from "react";
import { SupplierFrame } from "@/components/supplier/supplier-frame";
import { assertRouteAccessOrRedirect } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const context = await assertRouteAccessOrRedirect("/supplier");
  return (
    <Suspense fallback={null}>
      <SupplierFrame recipientId={context.userId ?? undefined} role={context.role}>
        {children}
      </SupplierFrame>
    </Suspense>
  );
}
