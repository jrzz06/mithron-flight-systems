import type { CmsRole } from "@/lib/auth/access-control";
import { PlatformShell } from "@/components/platform/platform-shell";
import { adminRouteTitles, buildAdminNavGroups, buildAdminSearchItems } from "@/components/platform/nav-config";

type AdminFrameProps = {
  role: CmsRole | null;
  userId?: string | null;
  pendingSupplierApprovals?: number;
  children: React.ReactNode;
};

export function AdminFrame({ role, userId, pendingSupplierApprovals = 0, children }: AdminFrameProps) {
  const groups = buildAdminNavGroups(role, pendingSupplierApprovals);
  const searchItems = buildAdminSearchItems(groups);

  return (
    <PlatformShell
      scope="admin"
      groups={groups}
      routeTitles={adminRouteTitles}
      searchItems={searchItems}
      role={role}
      userId={userId}
      scopeBadge="Admin"
      shellDataAttributes={{ "data-admin-shell": true }}
    >
      {children}
    </PlatformShell>
  );
}
