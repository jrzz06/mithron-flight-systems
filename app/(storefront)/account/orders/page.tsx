import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/admin/module-panel";
import { createClient } from "@/lib/server";
import { formatINR } from "@/lib/utils";
import { listCustomerOrders } from "@/services/customer-orders";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function AccountOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/orders");

  const orders = await listCustomerOrders(userId);

  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <h2 className="type-section">Your orders</h2>
      <div className="mt-6 grid gap-3">
        {orders.length ? orders.map((order) => (
          <Link
            key={String(order.id)}
            href={`/account/orders/${order.id}`}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 transition hover:border-white/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{String(order.order_number ?? order.id)}</p>
                <p className="mt-1 text-sm text-white/50">{String(order.created_at ?? "").slice(0, 10)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <StatusBadge status={String(order.status ?? "pending")} />
                  <StatusBadge status={String(order.fulfillment_status ?? "pending")} />
                </div>
                <p className="text-sm text-white/70">{formatINR(Number(order.total ?? 0))}</p>
              </div>
            </div>
          </Link>
        )) : (
          <p className="text-sm text-white/60">No orders yet. <Link href="/checkout" className="text-emerald-400">Start checkout</Link></p>
        )}
      </div>
    </div>
  );
}
