"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useResolvedCart } from "@/hooks/use-resolved-cart";
import { formatINR } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

export default function CartPage() {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const { items, subtotal, isResolving, pricesPending, error, refreshPricing } = useResolvedCart();
  const showPendingPrices = isResolving || pricesPending;

  return (
    <main className="surface-page inner-page min-h-screen">
      <section className="mx-auto max-w-[960px]">
        <h1 className="type-page">Cart</h1>
        {error ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void refreshPricing()}>
              Retry
            </button>
          </p>
        ) : null}
        <div className="mt-8 grid gap-4">
          {items.length ? items.map((item) => (
            <article key={`${item.productSlug}-${item.bundleId}`} className="rounded-[var(--ds-r-xl)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{item.productName}</p>
                  <p className="mt-1 text-sm text-white/60">{item.bundleName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.productSlug, item.bundleId, Number(event.target.value))}
                    className="min-h-11 w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-white"
                  />
                  <p className="font-semibold text-white">
                    {showPendingPrices ? "…" : formatINR(item.unitPrice * item.quantity)}
                  </p>
                  <button type="button" onClick={() => removeItem(item.productSlug, item.bundleId)} className="min-h-11 px-3 py-2 text-sm text-red-400">Remove</button>
                </div>
              </div>
            </article>
          )) : (
            <p className="text-white/60">Your cart is empty.</p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xl font-semibold text-white">Subtotal: {showPendingPrices ? "…" : formatINR(subtotal)}</p>
          <Button asChild disabled={!items.length || showPendingPrices}>
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
