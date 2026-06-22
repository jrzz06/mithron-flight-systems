"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Minus, Plus, ShieldCheck, ShoppingBag, Truck, Wrench, X } from "lucide-react";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { Button } from "@/components/ui/button";
import type { ProductShellItem } from "@/services/catalog";
import { glassButtonClassName } from "@/lib/glass-ui";
import { formatUsd } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

export function CartDrawer({ products }: { products: ProductShellItem[] }) {
  const router = useRouter();
  const { items, isCartOpen, setCartOpen, setQuantity, subtotal, taxTotal, grandTotal } = useCartStore(
    useShallow((state) => ({
      items: state.items,
      isCartOpen: state.isCartOpen,
      setCartOpen: state.setCartOpen,
      setQuantity: state.setQuantity,
      subtotal: state.subtotal(),
      taxTotal: state.taxTotal(),
      grandTotal: state.grandTotal()
    }))
  );
  const suggestions = products
    .filter((product) => product.interests.includes("agriculture") || product.interests.includes("components"))
    .slice(0, 3);

  useEffect(() => {
    if (!isCartOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen]);

  return (
    <div
      className={`cart-drawer-root fixed inset-0 z-[1002] ${isCartOpen ? "is-open" : ""}`}
      aria-hidden={isCartOpen ? "false" : "true"}
      aria-label="Mission cart"
      aria-modal={isCartOpen ? "true" : undefined}
      role={isCartOpen ? "dialog" : undefined}
    >
      <button
        type="button"
        tabIndex={isCartOpen ? 0 : -1}
        className="cart-drawer-backdrop absolute inset-0 bg-black/88"
        aria-label="Close cart"
        onClick={() => setCartOpen(false)}
      />
      <aside className="cart-drawer-panel ambient-surface ambient-dark absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col overflow-hidden text-white shadow-[0_20px_60px_rgba(15,23,42,.24)]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="type-meta text-white/40">Mission cart</p>
            <h2 className="type-card-title text-2xl">{items.length ? "Mission ready" : "No drone system selected"}</h2>
          </div>
          <button type="button" tabIndex={isCartOpen ? 0 : -1} aria-label="Close cart" onClick={() => setCartOpen(false)}>
            <X className="size-7" />
          </button>
        </div>
        {items.length ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {items.map((item) => (
                <div key={`${item.productSlug}-${item.bundleId}`} className="grid grid-cols-[82px_1fr] gap-4 border-b border-[var(--surface-border)] py-5">
                  <div className="relative size-20 rounded-xl bg-[#0c0c0c]">
                    {isCartOpen ? <MithronThumbImage src={item.image} alt={item.productName} fill className="object-contain p-2" sizes="80px" /> : null}
                  </div>
                  <div>
                    <h3 className="type-card-title text-base">{item.productName}</h3>
                    <p className="type-body text-sm text-white/50">{item.bundleName}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-white/10">
                        <button type="button" aria-label="Decrease quantity" className="p-2" onClick={() => setQuantity(item.productSlug, item.bundleId, item.quantity - 1)}>
                          <Minus className="size-4" />
                        </button>
                        <span className="type-price min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button type="button" aria-label="Increase quantity" className="p-2" onClick={() => setQuantity(item.productSlug, item.bundleId, item.quantity + 1)}>
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <span className="type-price font-medium">{formatUsd(item.unitPrice * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  [Truck, "Deployment"],
                  [Wrench, "Drone Care"],
                  [ShieldCheck, "Training"]
                ].map(([Icon, label]) => (
                  <div key={String(label)} className="type-button rounded-2xl border border-[var(--surface-border)] bg-white/5 p-3 text-center text-[11px] text-white/60">
                    <Icon className="mx-auto mb-2 size-5 text-white/80" />
                    {String(label)}
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t border-white/10 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                aria-label="Configure deployment"
                tabIndex={isCartOpen ? 0 : -1}
                className="block w-full text-left"
                onClick={() => {
                  setCartOpen(false);
                  router.push("/checkout");
                }}
              >
                <span className="type-price mb-4 grid gap-2 text-sm font-medium">
                  <span className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatUsd(subtotal)}</span>
                  </span>
                  {taxTotal > 0 ? (
                    <span className="flex items-center justify-between text-white/70">
                      <span>GST</span>
                      <span>{formatUsd(taxTotal)}</span>
                    </span>
                  ) : null}
                  <span className="flex items-center justify-between text-lg">
                    <span>Total</span>
                    <span>{formatUsd(grandTotal)}</span>
                  </span>
                </span>
                <span className={glassButtonClassName({ className: "type-button block h-14 w-full rounded-full text-center text-base leading-[3.5rem]" })}>
                  Configure deployment
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 text-center">
            <div className="ambient-surface ambient-muted rounded-[28px] border border-[var(--surface-border)] p-7">
              <ShoppingBag className="mx-auto mb-5 size-14 text-white/30" />
              <p className="type-card-title text-xl">Build a mission-ready drone stack</p>
              <p className="type-body mt-3 text-sm text-white/50">Add a drone platform or component bundle and keep deployment, service, and training context ready for checkout.</p>
              <Button className="mt-7" onClick={() => setCartOpen(false)}>Explore systems</Button>
            </div>
            <div className="mt-6 text-left">
              <p className="type-meta mb-3 text-white/40">Recommended starters</p>
              <div className="grid gap-3">
                {suggestions.map((product) => (
                  <button
                    key={product.slug}
                    type="button"
                    tabIndex={isCartOpen ? 0 : -1}
                    className="cart-suggestion-card ambient-surface ambient-muted grid grid-cols-[68px_1fr] items-center gap-4 rounded-2xl border border-[var(--surface-border)] p-3 text-left"
                    onClick={() => {
                      setCartOpen(false);
                      router.push(`/product/${product.slug}`);
                    }}
                  >
                    <span className="relative size-16 rounded-xl bg-white/5">
                      {isCartOpen ? <MithronThumbImage src={product.image.src} alt={product.image.alt} responsive={product.image.responsive} fill className="object-contain p-2" sizes="64px" /> : null}
                    </span>
                    <span>
                      <span className="type-card-title block text-sm">{product.name}</span>
                      <span className="type-price mt-1 block text-xs font-medium text-white/50">From {formatUsd(product.price)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                [Truck, "Deploy"],
                [Wrench, "Service"],
                [ShieldCheck, "Train"]
              ].map(([Icon, label]) => (
                <div key={String(label)} className="type-button rounded-2xl border border-[var(--surface-border)] bg-white/5 p-3 text-center text-[11px] text-white/60">
                  <Icon className="mx-auto mb-2 size-5 text-white/80" />
                  {String(label)}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
