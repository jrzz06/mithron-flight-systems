import { WarehouseFrame } from "@/components/warehouse/warehouse-frame";
import { assertRouteAccessOrRedirect } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  await assertRouteAccessOrRedirect("/warehouse");
  return <WarehouseFrame>{children}</WarehouseFrame>;
}
