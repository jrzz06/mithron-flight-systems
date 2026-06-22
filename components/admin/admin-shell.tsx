import { AdminFrame } from "@/components/admin/admin-frame";
import { countPendingSupplierProducts } from "@/services/supplier-actions";
import type { CmsRole } from "@/lib/auth/access-control";

export async function AdminShell({
  role,
  userId,
  children
}: {
  role: CmsRole;
  userId: string | null;
  children: React.ReactNode;
}) {
  const pendingSupplierApprovals = await countPendingSupplierProducts();
  return (
    <AdminFrame role={role} userId={userId} pendingSupplierApprovals={pendingSupplierApprovals}>
      {children}
    </AdminFrame>
  );
}
