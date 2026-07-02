"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useResolvedCart } from "@/hooks/use-resolved-cart";
import { formatINR } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

export function CartPageClient() {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const { items, subtotal, isResolving, pricesPending, error, refreshPricing } = useResolvedCart();
  const showPendingPrices = isResolving || pricesPending;

  return (
    <main className="surface-page inner-page min-h-screen max-[767px]:px-0">
      <section className="mx-auto max-w-[960px] max-[767px]:px-4">
        <h1 className="type-page">Cart</h1>
        {error ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void refreshPricing()}>
              Retry
            </button>
          </p>
        ) : null}
        <div className="mt-8 grid gap-6 max-[767px]:gap-4">
          {items.length ? items.map((item) => (
            <article key={`${item.productSlug}-${item.bundleId}`} className="rounded-[var(--ds-r-xl)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-5 max-[767px]:p-4">
              <div className="flex flex-wrap items-center justify-between gap-4 max-[390px]:flex-col max-[390px]:items-stretch">
                <div className="min-w-0 max-[390px]:w-full">
                  <p className="font-semibold text-white">{item.productName}</p>
                  <p className="mt-1 text-sm text-white/60">{item.bundleName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 max-[390px]:w-full max-[390px]:justify-between">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.productSlug, item.bundleId, Number(event.target.value))}
                    className="min-h-11 min-w-11 w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-white max-[767px]:min-h-[44px] max-[767px]:min-w-[44px]"
                  />
                  <p className="font-semibold text-white">
                    {showPendingPrices ? "…" : formatINR(item.unitPrice * item.quantity)}
                  </p>
                  <button type="button" onClick={() => removeItem(item.productSlug, item.bundleId)} className="min-h-11 min-w-11 px-3 py-2 text-sm text-red-400 max-[767px]:min-h-[44px]">Remove</button>
                </div>
              </div>
            </article>
          )) : (
            <p className="text-white/60">Your cart is empty.</p>
          )}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 max-[767px]:mt-6">
          <p className="text-xl font-semibold text-white">Subtotal: {showPendingPrices ? "…" : formatINR(subtotal)}</p>
          <Button asChild disabled={!items.length || showPendingPrices}>
            <Link href="/checkout">Proceed to checkout</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
