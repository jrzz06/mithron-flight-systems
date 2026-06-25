import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { DataList, OperationalFeedback } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { WarehouseCodeSelect } from "@/components/warehouse/warehouse-code-select";
import { getWarehouseSnapshot } from "@/services/admin";
import { getDefaultWarehouseCode } from "@/services/warehouse-config";
import { listActiveWarehouses } from "@/services/warehouses";
import { applyWarehouseMovementFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

function text(input: unknown, fallback = "n/a") {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/transfers?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Stock transfer action failed.";
}

async function recordTransfer(formData: FormData) {
  "use server";
  try {
    await applyWarehouseMovementFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", errorText(error)));
  }
  redirect(feedbackPath("success", "Transfer movement recorded."));
}

export default async function TransfersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [snapshot, warehouses, defaultWarehouseCode] = await Promise.all([
    getWarehouseSnapshot({ scope: "transfers" }),
    listActiveWarehouses(),
    getDefaultWarehouseCode()
  ]);
  const params = searchParams ? await searchParams : {};
  const operationStatus = value(params, "operation_status");
  const operationMessage = value(params, "operation_message");
  const transferRows = snapshot.data.movements.filter((movement) => text(movement.movement_type) === "transfer").slice(0, 10);
  const stockOptions = snapshot.data.stock.slice(0, 80);

  return (
    <ControlShell
      eyebrow="Stock transfers"
      title="Transfer stock"
      description={snapshot.blockedReason ?? "Transfers are recorded through the immutable inventory movement ledger and update the selected warehouse stock row."}
      metrics={[
        { label: "Stock rows", value: String(snapshot.data.stock.length) },
        { label: "Transfers", value: String(transferRows.length) },
        { label: "Warehouses", value: String(new Set(snapshot.data.stock.map((row) => text(row.warehouse_code, ""))).size) }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Activity", href: "/warehouse/activity" },
        { label: "Settings", href: "/warehouse/settings" }
      ]}
    >
      <section data-stock-transfer-workflow className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <OperationalFeedback status={operationStatus} message={operationMessage} context="Stock transfer" idle="Transfer validation and ledger status appear here." />
          <DataList
            rows={transferRows.length ? transferRows.map((movement) => ({
              label: `${text(movement.product_slug, "product")} / ${text(movement.sku, "sku")}`,
              value: `${Number(movement.quantity_delta ?? 0) >= 0 ? "+" : ""}${String(movement.quantity_delta ?? 0)}`,
              detail: `${text(movement.warehouse_code, "warehouse")} | ${text(movement.reason_code, "transfer")} | ${text(movement.created_at, "no timestamp")}`
            })) : [{ label: "Transfers", value: "0", detail: "No transfer movements are visible yet." }]}
          />
        </div>

        <form action={recordTransfer} className="grid content-start gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
          <input name="movement_type" type="hidden" value="transfer" />
          <label className="grid gap-1 text-xs font-medium text-slate-500">
            Product and SKU
            <select name="product_slug" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100">
              {stockOptions.map((row) => (
                <option key={`${text(row.warehouse_code)}:${text(row.product_slug)}:${text(row.sku)}`} value={text(row.product_slug, "")}>
                  {text(row.product_slug)} / {text(row.sku)} / {text(row.warehouse_code)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500">
            SKU
            <input name="sku" defaultValue={text(stockOptions[0]?.sku, "")} className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
          </label>
          <WarehouseCodeSelect
            warehouses={warehouses}
            defaultValue={text(stockOptions[0]?.warehouse_code, defaultWarehouseCode)}
          />
          <label className="grid gap-1 text-xs font-medium text-slate-500">
            Quantity delta
            <input name="quantity_delta" defaultValue="-1" inputMode="numeric" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
          </label>
          <input name="reason_code" type="hidden" value="warehouse_transfer" />
          <label className="grid gap-1 text-xs font-medium text-slate-500">
            Transfer note
            <input name="notes" defaultValue="" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
          </label>
          <input name="change_summary" type="hidden" value="Record warehouse stock transfer" />
          <OperationalSubmitButton pendingLabel="Recording" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-100">
            Record transfer
          </OperationalSubmitButton>
        </form>
      </section>
    </ControlShell>
  );
}
