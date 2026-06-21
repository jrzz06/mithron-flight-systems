"use client";

import { ShoppingBag } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useCartStore } from "@/store/cart";

export function CartNavButton() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const count = useCartStore((state) => state.itemCount());
  const setCartOpen = useCartStore((state) => state.setCartOpen);

  const displayCount = hydrated ? count : 0;

  return (
    <button
      type="button"
      aria-label={`Open cart${displayCount ? `, ${displayCount} items` : ""}`}
      data-testid="nav-cart-button"
      onClick={() => setCartOpen(true)}
      className="adaptive-navbar__icon nav-interactive nav-interactive--subtle relative inline-flex size-10 items-center justify-center rounded-full text-current"
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
