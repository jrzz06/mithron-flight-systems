import { Suspense } from "react";
import { SupplierFrame } from "@/components/supplier/supplier-frame";
import { canAccessProtectedPath, defaultPathForRole } from "@/lib/auth/access-control";
import { getCurrentAuthContext } from "@/services/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAuthContext();
  if (!canAccessProtectedPath(context.role, "/supplier")) {
    redirect(defaultPathForRole(context.role));
  }
  return (
    <Suspense fallback={null}>
      <SupplierFrame recipientId={context.userId ?? undefined}>{children}</SupplierFrame>
    </Suspense>
  );
}
