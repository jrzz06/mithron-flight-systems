import { NextResponse } from "next/server";
import { getCachedPendingSupplierProductCount } from "@/services/supplier-actions";
import { requireRouteAccess } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRouteAccess("/admin");
  const pendingSupplierApprovals = await getCachedPendingSupplierProductCount();
  return NextResponse.json({ pendingSupplierApprovals });
}
