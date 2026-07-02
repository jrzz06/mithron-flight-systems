"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Minus, Plus, ShieldCheck, ShoppingBag, Truck, Wrench, X } from "lucide-react";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { Button } from "@/components/ui/button";
import type { CatalogSearchResult } from "@/services/catalog";
import { formatINR } from "@/lib/utils";
import { useResolvedCart } from "@/hooks/use-resolved-cart";
import { useCartStore } from "@/store/cart";
import styles from "./cart-drawer.module.css";

type MissionServiceId = "deployment" | "drone-care" | "training";

const MISSION_SERVICES: ReadonlyArray<{
  id: MissionServiceId;
  icon: LucideIcon;
  label: string;
}> = [
  { id: "deployment", icon: Truck, label: "Deployment" },
  { id: "drone-care", icon: Wrench, label: "Drone Care" },
  { id: "training", icon: ShieldCheck, label: "Training" }
];

function MissionServicesSection({
  selectedServices,
  onToggle,
  tabIndex
}: {
  selectedServices: Set<MissionServiceId>;
  onToggle: (id: MissionServiceId) => void;
  tabIndex: number;
}) {
  return (
    <section aria-labelledby="mission-services-heading">
      <h3 id="mission-services-heading" className={styles.sectionLabel}>
        Mission services
      </h3>
      <div className={styles.serviceGrid} role="group" aria-label="Mission services">
        {MISSION_SERVICES.map(({ id, icon: Icon, label }) => {
          const selected = selectedServices.has(id);
          return (
            <button
              key={id}
              type="button"
              tabIndex={tabIndex}
              aria-pressed={selected}
              className={`${styles.serviceCard} ${selected ? styles.serviceCardSelected : ""}`.trim()}
              onClick={() => onToggle(id)}
            >
              <Icon className={styles.serviceIcon} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CartOrderSummary({
  subtotal,
  taxTotal,
  grandTotal,
  isResolving,
  pricesPending
}: {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  isResolving: boolean;
  pricesPending: boolean;
}) {
  const showPendingPrices = isResolving || pricesPending;

  return (
    <section aria-labelledby="cart-order-summary-heading" className={styles.summaryBlock}>
      <h3 id="cart-order-summary-heading" className={styles.sectionLabel}>
        Order summary
      </h3>
      <div className={styles.summaryRow}>
        <span>Subtotal</span>
        <strong>{showPendingPrices ? "…" : formatINR(subtotal)}</strong>
      </div>
      {taxTotal > 0 || showPendingPrices ? (
        <div className={styles.summaryRow}>
          <span>GST</span>
          <strong>{showPendingPrices ? "…" : formatINR(taxTotal)}</strong>
        </div>
      ) : null}
      <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
        <span>Total</span>
        <strong>{showPendingPrices ? "…" : formatINR(grandTotal)}</strong>
      </div>
    </section>
  );
}

export function CartDrawer() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<CatalogSearchResult[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<MissionServiceId>>(
    () => new Set(MISSION_SERVICES.map((service) => service.id))
  );
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const isCartOpen = useCartStore((state) => state.isCartOpen);
  const { items, subtotal, taxTotal, grandTotal, isResolving, pricesPending, error, refreshPricing } = useResolvedCart();
  const drawerTabIndex = isCartOpen ? 0 : -1;
  const showPendingPrices = isResolving || pricesPending;

  useEffect(() => {
    if (!isCartOpen || items.length) return;

    let active = true;
    const controller = new AbortController();

    void fetch("/api/catalog/search?intent=cart", {
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = (await response.json()) as { results?: CatalogSearchResult[] };
        if (!response.ok || !active) return;
        setSuggestions(payload.results ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSuggestions([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isCartOpen, items.length]);

  useEffect(() => {
    if (!isCartOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen]);

  const toggleService = (id: MissionServiceId) => {
    setSelectedServices((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const goToCheckout = () => {
    setCartOpen(false);
    router.push("/checkout");
  };

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
        tabIndex={drawerTabIndex}
        className="cart-drawer-backdrop absolute inset-0 bg-black/88"
        aria-label="Close cart"
        onClick={() => setCartOpen(false)}
      />
      <aside
        className={`cart-drawer-panel ${styles.drawerPanel} absolute inset-y-0 right-0 flex h-dvh w-full max-w-[440px] flex-col overflow-hidden text-white shadow-[0_20px_60px_rgba(15,23,42,.24)]`}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerEyebrow}>Mission cart</p>
            <h2 className={styles.drawerTitle}>{items.length ? "Mission ready" : "No drone system selected"}</h2>
          </div>
          <button
            type="button"
            tabIndex={drawerTabIndex}
            aria-label="Close cart"
            className={styles.closeButton}
            onClick={() => setCartOpen(false)}
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </header>

        {items.length ? (
          <div className={styles.drawerFilled}>
            <div className={styles.drawerBody}>
              {error ? (
                <p className={styles.pricingNotice} role="status">
                  {error}{" "}
                  <button type="button" className={styles.pricingRetry} onClick={() => void refreshPricing()}>
                    Retry pricing
                  </button>
                </p>
              ) : null}
              <section aria-label="Cart items">
                {items.map((item, index) => (
                  <article key={`${item.productSlug}-${item.bundleId}`}>
                    {index > 0 ? <hr className={styles.sectionDivider} /> : null}
                    <div className={styles.productRow}>
                      <div className={styles.productThumb}>
                        {isCartOpen ? (
                          <MithronThumbImage
                            src={item.image}
                            alt={item.productName}
                            fill
                            className="object-contain p-2.5"
                            sizes="96px"
                          />
                        ) : null}
                      </div>
                      <div className={styles.productCopy}>
                        <h3 className={styles.productName}>{item.productName}</h3>
                        <p className={styles.productConfig}>{item.bundleName}</p>
                        <div className={styles.productActions}>
                          <div className={styles.quantityControl}>
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              className={styles.quantityButton}
                              onClick={() => setQuantity(item.productSlug, item.bundleId, item.quantity - 1)}
                            >
                              <Minus className="size-3.5" aria-hidden="true" />
                            </button>
                            <span className={styles.quantityValue}>{item.quantity}</span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              className={styles.quantityButton}
                              onClick={() => setQuantity(item.productSlug, item.bundleId, item.quantity + 1)}
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          <span className={styles.linePrice}>
                            {showPendingPrices ? "…" : formatINR(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              <hr className={styles.sectionDivider} />

              <MissionServicesSection
                selectedServices={selectedServices}
                onToggle={toggleService}
                tabIndex={drawerTabIndex}
              />

              <hr className={styles.sectionDivider} />

              <CartOrderSummary
                subtotal={subtotal}
                taxTotal={taxTotal}
                grandTotal={grandTotal}
                isResolving={isResolving}
                pricesPending={pricesPending}
              />
            </div>

            <footer className={styles.drawerFooter}>
              <button
                type="button"
                aria-label="Configure deployment"
                tabIndex={drawerTabIndex}
                className={`${styles.ctaButton} type-button`}
                onClick={goToCheckout}
              >
                Configure deployment
              </button>
            </footer>
          </div>
        ) : (
          <div className={styles.emptyBody}>
            <div className={styles.emptyHero}>
              <ShoppingBag className="mx-auto mb-4 size-12 text-white/30" aria-hidden="true" />
              <p className="type-card-title text-lg">Build a mission-ready drone stack</p>
              <p className="type-body mt-2 text-sm text-white/50">
                Add a drone platform or component bundle and keep deployment, service, and training context ready for
                checkout.
              </p>
              <Button className="mt-5" onClick={() => setCartOpen(false)}>
                Explore systems
              </Button>
            </div>

            {suggestions.length ? (
              <div className="mt-5 text-left">
                <p className={styles.sectionLabel}>Recommended starters</p>
                <div className="mt-2 grid gap-2">
                  {suggestions.map((product) => (
                    <button
                      key={product.slug}
                      type="button"
                      tabIndex={drawerTabIndex}
                      className={`${styles.suggestionCard} cart-suggestion-card`}
                      onClick={() => {
                        setCartOpen(false);
                        router.push(`/product/${product.slug}`);
                      }}
                    >
                      <span className="relative size-[68px] rounded-[2px] bg-white/5">
                        {isCartOpen ? (
                          <MithronThumbImage
                            src={product.image.src}
                            alt={product.image.alt}
                            responsive={product.image.responsive}
                            fill
                            className="object-contain p-2"
                            sizes="68px"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="type-card-title block truncate text-sm">{product.name}</span>
                        <span className="type-price mt-0.5 block text-xs font-medium text-white/50">
                          From {formatINR(product.price)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <hr className={styles.sectionDivider} />

            <MissionServicesSection
              selectedServices={selectedServices}
              onToggle={toggleService}
              tabIndex={drawerTabIndex}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
