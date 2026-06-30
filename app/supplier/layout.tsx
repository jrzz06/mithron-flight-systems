import { SupplierFeedbackDialog } from "@/components/supplier/supplier-feedback-dialog";
import { ControlPlaneParallelLayout } from "@/components/platform/control-plane-parallel-layout";
import { assertRouteAccessOrRedirect } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function SupplierLayout({
  children,
  shell
}: {
  children: React.ReactNode;
  shell: React.ReactNode;
}) {
  await assertRouteAccessOrRedirect("/supplier");

  return (
    <>
      <SupplierFeedbackDialog />
      <ControlPlaneParallelLayout
        scope="supplier"
        shell={shell}
        shellDataAttributes={{ "data-supplier-frame": true }}
      >
        {children}
      </ControlPlaneParallelLayout>
    </>
  );
}
