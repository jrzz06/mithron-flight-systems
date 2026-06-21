import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function WarehouseLedgerRedirect() {
  redirect("/warehouse/movements");
}
