"use client";

import { ShoppingBag } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { useCartItemCount, useCartStore } from "@/store/cart";

function preloadCartDrawer() {
  void import("@/components/overlays/cart-drawer").catch((error: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Cart drawer preload failed", error);
    }
  });
}

export function CartNavButton() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const count = useCartItemCount();
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const handlePointerEnter = useCallback(() => {
    preloadCartDrawer();
  }, []);

  const displayCount = hydrated ? count : 0;

  return (
    <button
      type="button"
      aria-label={`Open cart${displayCount ? `, ${displayCount} items` : ""}`}
      data-testid="nav-cart-button"
      onFocus={handlePointerEnter}
      onPointerEnter={handlePointerEnter}
      onClick={() => setCartOpen(true)}
      className="adaptive-navbar__icon nav-interactive nav-interactive--subtle relative inline-flex size-11 items-center justify-center rounded-full text-current"
    >
      <ShoppingBag className="size-[18px]" />
      {displayCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[#22d216] px-1 text-[10px] font-bold text-black">
          {displayCount}
        </span>
      ) : null}
    </button>
  );
}
