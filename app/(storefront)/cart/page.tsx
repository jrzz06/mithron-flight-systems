"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  return (
    <main className="surface-page min-h-screen px-6 py-28 md:px-16">
      <section className="mx-auto max-w-[960px]">
        <h1 className="type-page">Cart</h1>
        <div className="mt-8 grid gap-4">
          {items.length ? items.map((item) => (
            <article key={`${item.productSlug}-${item.bundleId}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{item.productName}</p>
                  <p className="mt-1 text-sm text-white/60">{item.bundleName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.productSlug, item.bundleId, Number(event.target.value))}
                    className="w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-white"
                  />
                  <p className="font-semibold text-white">{formatUsd(item.unitPrice * item.quantity)}</p>
                  <button type="button" onClick={() => removeItem(item.productSlug, item.bundleId)} className="text-sm text-red-400">Remove</button>
                </div>
              </div>
            </article>
          )) : (
            <p className="text-white/60">Your cart is empty.</p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xl font-semibold text-white">Subtotal: {formatUsd(subtotal)}</p>
          <Button asChild disabled={!items.length}>
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
