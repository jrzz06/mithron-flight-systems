import { AdminSection } from "@/components/admin/module-panel";
import { StatusBadge } from "@/components/admin/module-panel";
import { formatINR } from "@/lib/utils";
import { listSupplierOrderVisibility } from "@/services/supplier-orders";
import { getCurrentAuthContext } from "@/services/auth";

export default async function SupplierOrdersPage() {
  const context = await getCurrentAuthContext();
  const rows = context.userId ? await listSupplierOrderVisibility(context.userId) : [];

  const grouped = rows.reduce<Map<string, typeof rows>>((acc, row) => {
    const key = row.orderId;
    const list = acc.get(key) ?? [];
    list.push(row);
    acc.set(key, list);
    return acc;
  }, new Map());

  return (
    <div className="grid gap-5">
      <AdminSection
        title="Customer orders"
        description="Read-only visibility into orders that include your products. Fulfillment is handled by Mithron warehouse."
      >
        <div className="grid gap-3">
          {[...grouped.entries()].length ? [...grouped.entries()].map(([orderId, lines]) => {
            const head = lines[0];
            return (
              <div
                key={orderId}
                className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-[var(--platform-text-primary)]">{head.orderNumber}</p>
                  <StatusBadge status={head.orderStatus} />
                  <StatusBadge status={head.fulfillmentStatus} />
                </div>
                <p className="mt-1 text-xs text-[var(--platform-text-muted)]">
                  Payment {head.paymentStatus} · {head.createdAt.slice(0, 10)}
                </p>
                <ul className="mt-3 grid gap-2 text-sm text-[var(--platform-text-secondary)]">
                  {lines.map((line) => (
                    <li key={`${line.orderId}-${line.productSlug}`}>
                      {line.productName} × {line.quantity} · {formatINR(line.lineTotal)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }) : (
            <p className="text-sm text-[var(--platform-text-secondary)]">No customer orders include your products yet.</p>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
