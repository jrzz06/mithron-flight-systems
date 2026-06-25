import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import { listCustomerAddresses } from "@/services/customer-addresses";
import { createAddressFormAction, deleteAddressFormAction, updateAddressFormAction } from "./actions";

export default async function AccountAddressesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/addresses");

  const addresses = await listCustomerAddresses(userId);

  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
        <h2 className="type-section">Saved addresses</h2>
        <div className="mt-6 grid gap-3">
          {addresses.length ? addresses.map((address) => (
            <article key={String(address.id)} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
              <p className="font-semibold text-white">{String(address.label ?? "Address")}</p>
              <p className="mt-2 text-sm text-white/70">
                {String(address.line1)} {address.line2 ? `, ${String(address.line2)}` : ""}
                <br />
                {String(address.city)}, {String(address.region)} {String(address.postal_code)}
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-emerald-400">Edit address</summary>
                <form action={updateAddressFormAction} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="address_id" value={String(address.id)} />
                  <input name="label" defaultValue={String(address.label ?? "Home")} placeholder="Label" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                  <input name="line1" required defaultValue={String(address.line1)} placeholder="Address line 1" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white md:col-span-2" />
                  <input name="city" required defaultValue={String(address.city)} placeholder="City" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                  <input name="region" required defaultValue={String(address.region)} placeholder="Region" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
                  <input name="postal_code" required defaultValue={String(address.postal_code)} placeholder="Postal code" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white md:col-span-2" />
                  <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black md:col-span-2">Save changes</button>
                </form>
              </details>
              <form action={deleteAddressFormAction} className="mt-4">
                <input type="hidden" name="address_id" value={String(address.id)} />
                <button type="submit" className="text-sm text-red-400">Remove</button>
              </form>
            </article>
          )) : (
            <p className="text-sm text-white/60">No addresses saved yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
        <h3 className="text-lg font-semibold text-white">Add address</h3>
        <form action={createAddressFormAction} className="mt-6 grid gap-3 md:grid-cols-2">
          <input name="label" placeholder="Label" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
          <input name="line1" required placeholder="Address line 1" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white md:col-span-2" />
          <input name="line2" placeholder="Address line 2" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white md:col-span-2" />
          <input name="city" required placeholder="City" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
          <input name="region" required placeholder="Region" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
          <input name="postal_code" required placeholder="Postal code" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
          <input name="country" defaultValue="India" placeholder="Country" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
          <input name="phone" placeholder="Phone" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
          <label className="flex items-center gap-2 text-sm text-white/70 md:col-span-2">
            <input type="checkbox" name="is_default" /> Set as default
          </label>
          <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black md:col-span-2">Save address</button>
        </form>
      </section>
    </div>
  );
}
