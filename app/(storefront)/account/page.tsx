import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";
import { listOwnEnquiries } from "@/services/enquiries";
import { listCustomerOrders } from "@/services/customer-orders";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login?next=/account");

  const userId = typeof claims.sub === "string" ? claims.sub : "";
  const email = typeof claims.email === "string" ? claims.email : "Signed-in customer";
  const orders = userId ? await listCustomerOrders(userId) : [];
  const enquiries = userId ? await listOwnEnquiries(userId) : [];

  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
        <p className="type-meta text-white/50">Welcome back</p>
        <h2 className="type-section mt-3">{email}</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link href="/products">Browse products</Link></Button>
          <Button asChild variant="outline"><Link href="/checkout">Checkout</Link></Button>
          <Button asChild variant="outline"><Link href="/contact">Contact sales</Link></Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-6">
          <p className="text-xs uppercase tracking-[0.12em] text-white/40">Recent orders</p>
          <p className="mt-2 text-3xl font-semibold text-white">{orders.length}</p>
          <Link href="/account/orders" className="mt-4 inline-block text-sm text-emerald-400">View orders</Link>
        </article>
        <article className="rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-6">
          <p className="text-xs uppercase tracking-[0.12em] text-white/40">Enquiries</p>
          <p className="mt-2 text-3xl font-semibold text-white">{enquiries.length}</p>
          <Link href="/account/enquiries" className="mt-4 inline-block text-sm text-emerald-400">View enquiries</Link>
        </article>
      </div>
    </div>
  );
}
