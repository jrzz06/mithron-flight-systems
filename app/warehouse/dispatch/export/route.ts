import { NextResponse } from "next/server";
import { getWarehouseSnapshot } from "@/services/admin";
import { guardExportRoute } from "@/lib/auth/export-route-auth";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export async function GET() {
  const denied = await guardExportRoute("warehouse.write");
  if (denied) return denied;

  const snapshot = await getWarehouseSnapshot({ scope: "dispatch" });
  const orderNumberById = new Map(
    snapshot.data.orders.map((order) => [String(order.id ?? ""), String(order.order_number ?? "")])
  );
  const headers = ["Shipment", "Order", "Warehouse", "Courier", "Tracking number", "Status", "Updated"];
  const rows = snapshot.data.shipments.map((shipment) => [
    shipment.shipment_number ?? shipment.id ?? "",
    orderNumberById.get(String(shipment.order_id ?? "")) ?? "",
    shipment.warehouse_id ?? "",
    shipment.carrier_name ?? "",
    shipment.tracking_number ?? "",
    shipment.shipment_status ?? "",
    shipment.updated_at ?? ""
  ]);
  const body = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=warehouse-dispatch.csv"
    }
  });
}
