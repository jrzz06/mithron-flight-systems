import { AdminNavMetricsProvider } from "@/components/admin/admin-nav-metrics-provider";
import { ControlPlaneParallelLayout } from "@/components/platform/control-plane-parallel-layout";
import { assertRouteAccessOrRedirect } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  shell
}: {
  children: React.ReactNode;
  shell: React.ReactNode;
}) {
  await assertRouteAccessOrRedirect("/admin");

  return (
    <AdminNavMetricsProvider>
      <ControlPlaneParallelLayout scope="admin" shell={shell} shellDataAttributes={{ "data-admin-shell": true }}>
        {children}
      </ControlPlaneParallelLayout>
    </AdminNavMetricsProvider>
  );
}
