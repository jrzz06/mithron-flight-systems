import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/admin/module-panel";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";
import { formatEnquiryReference, listOwnEnquiries } from "@/services/enquiries";
import { listCustomerOrders } from "@/services/customer-orders";
import { formatINR } from "@/lib/utils";
import { humanStatus } from "@/lib/platform/copy";

async function getProfileDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return typeof data?.display_name === "string" ? data.display_name.trim() : "";
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login?next=/account");

  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : "";
  const profileName = userId ? await getProfileDisplayName(supabase, userId) : "";
  const metadataName = typeof claims.user_metadata?.display_name === "string"
    ? claims.user_metadata.display_name.trim()
    : typeof claims.user_metadata?.full_name === "string"
      ? claims.user_metadata.full_name.trim()
      : "";
  const customerName = profileName || metadataName || email || "Signed-in customer";
  const orders = userId ? await listCustomerOrders(userId) : [];
  const enquiries = userId ? await listOwnEnquiries(userId) : [];
  const recentOrders = orders.slice(0, 3);
  const recentEnquiries = enquiries.slice(0, 3);

  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
        <p className="type-meta text-white/50">Welcome back</p>
        <h2 className="type-section mt-3">{customerName}</h2>
        {email ? <p className="mt-2 text-sm text-white/60">{email}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link href="/products">Browse products</Link></Button>
          <Button asChild variant="outline"><Link href="/checkout">Checkout</Link></Button>
          <Button asChild variant="outline"><Link href="/contact">Submit enquiry</Link></Button>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/50">Recent orders</h3>
          <Link href="/account/orders" className="text-sm text-emerald-400">View all orders</Link>
        </div>
        {recentOrders.length ? (
          <div className="grid gap-3">
            {recentOrders.map((order) => (
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
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--surface-border)] px-4 py-6 text-sm text-white/60">
            No orders yet. <Link href="/checkout" className="text-emerald-400">Start checkout</Link>
          </p>
        )}
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/50">Recent enquiries</h3>
          <Link href="/account/enquiries" className="text-sm text-emerald-400">View all enquiries</Link>
        </div>
        {recentEnquiries.length ? (
          <div className="grid gap-3">
            {recentEnquiries.map((enquiry) => {
              const enquiryNumber = typeof enquiry.enquiry_number === "number"
                ? enquiry.enquiry_number
                : Number(enquiry.enquiry_number);
              const reference = Number.isFinite(enquiryNumber) && enquiryNumber > 0
                ? formatEnquiryReference(enquiryNumber)
                : String(enquiry.subject ?? "Enquiry");
              return (
                <Link
                  key={String(enquiry.id)}
                  href={`/account/enquiries/${enquiry.id}`}
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 transition hover:border-white/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{reference}</p>
                      <p className="mt-1 truncate text-sm text-white/60">{String(enquiry.subject ?? enquiry.body ?? "").slice(0, 80)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs uppercase tracking-[0.1em] text-emerald-400">
                        {humanStatus(String(enquiry.status ?? "new"))}
                      </span>
                      <p className="text-xs text-white/40">{String(enquiry.created_at ?? "").slice(0, 10)}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--surface-border)] px-4 py-6 text-sm text-white/60">
            No enquiries yet. <Link href="/contact" className="text-emerald-400">Contact sales</Link>
          </p>
        )}
      </section>
    </div>
  );
}
