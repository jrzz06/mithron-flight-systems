import Link from "next/link";
import { ControlShell } from "@/components/admin/control-shell";
import { DataList, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { formatINR } from "@/lib/utils";
import { getWarehouseSnapshot } from "@/services/admin";
import { updateWarehouseOrderLifecycleFormAction } from "../actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/allocate?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Allocation failed.";
}

async function allocateOrderWithFeedback(formData: FormData) {
  "use server";
  try {
    formData.set("fulfillment_status", "processing");
    formData.set("status", "processing");
    await updateWarehouseOrderLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Inventory allocated — order moved to processing."));
}

export default async function WarehouseAllocatePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "orders" });
  const params = searchParams ? await searchParams : {};
  const operationStatus = searchValue(params, "operation_status");
  const operationMessage = searchValue(params, "operation_message");

  const assignableOrders = snapshot.data.orders.filter((order) => {
    const fulfillment = String(order.fulfillment_status ?? "pending");
    const payment = String(order.payment_status ?? "");
    const status = String(order.status ?? "");
    return (
      (fulfillment === "pending" || status === "assigned" || status === "confirmed" || status === "paid") &&
      ["paid", "succeeded", "confirmed", "assigned"].includes(status) &&
      payment !== "requires_payment"
    );
  });

  const rows = assignableOrders.slice(0, 24).map((order) => ({
    label: String(order.order_number ?? order.id ?? "order"),
    value: String(order.fulfillment_status ?? "pending"),
    detail: `${String(order.customer_email ?? "No customer")} | ${formatINR(Number(order.total ?? 0))}`
  }));

  return (
    <ControlShell
      eyebrow="Warehouse"
      title="Allocate inventory"
      description="Confirm stock reservation and move paid orders into the processing queue."
    >
      <OperationalFeedback status={operationStatus} message={operationMessage} />
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--platform-text-primary)]">Orders awaiting allocation</h2>
        <DataList rows={rows} />
      </section>

      <section className="mt-6 grid gap-4">
        {assignableOrders.length ? assignableOrders.slice(0, 12).map((order) => {
          const orderId = String(order.id ?? "");
          return (
            <div
              key={orderId}
              className="rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--platform-text-primary)]">{String(order.order_number ?? orderId)}</p>
                  <p className="text-sm text-[var(--platform-text-secondary)]">{String(order.customer_email ?? "")}</p>
                </div>
                <StatusBadge status={String(order.fulfillment_status ?? "pending")} />
              </div>
              <form action={allocateOrderWithFeedback} className="mt-4 flex flex-wrap items-center gap-3">
                <input type="hidden" name="order_id" value={orderId} />
                <input type="hidden" name="expected_updated_at" value={String(order.updated_at ?? "")} />
                <input type="hidden" name="change_summary" value={`Allocate inventory for ${String(order.order_number ?? orderId)}`} />
                <OperationalSubmitButton pendingLabel="Allocating">Allocate & start processing</OperationalSubmitButton>
                <Link href={`/warehouse/orders?q=${encodeURIComponent(String(order.order_number ?? orderId))}`} className="text-sm text-[var(--platform-accent)]">
                  View order
                </Link>
              </form>
            </div>
          );
        }) : (
          <p className="text-sm text-[var(--platform-text-secondary)]">
            All caught up. New paid orders appear here for allocation.
          </p>
        )}
      </section>
    </ControlShell>
  );
}
