import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CheckoutDraft, CheckoutStep } from "@/config/types";
import { summarizeCartTax } from "@/lib/product-tax";

export type NewCartItem = Omit<CartItem, "quantity">;

export type CartSlice = {
  items: CartItem[];
  checkout: CheckoutDraft;
  isCartOpen: boolean;
  hasOpenedCart: boolean;
  addItem: (item: NewCartItem) => void;
  removeItem: (productSlug: string, bundleId: string) => void;
  setQuantity: (productSlug: string, bundleId: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutStep: (step: CheckoutStep) => void;
  setPromoCode: (promoCode: string) => void;
  setCheckoutEmail: (email: string) => void;
  setCheckoutRegion: (region: string) => void;
  setShippingAddressId: (addressId: string) => void;
  setBillingAddressId: (addressId: string) => void;
  setCheckoutOrderMeta: (meta: Partial<Pick<CheckoutDraft, "paymentIntentId" | "orderId">>) => void;
  subtotal: () => number;
  taxTotal: () => number;
  grandTotal: () => number;
  itemCount: () => number;
};

const initialCheckout: CheckoutDraft = {
  step: "cart",
  promoCode: "",
  email: "",
  region: "India"
};

export function createCartSlice(): CartSlice {
  const slice: CartSlice = {
    items: [],
    checkout: initialCheckout,
    isCartOpen: false,
    hasOpenedCart: false,
    addItem(item) {
      const existing = slice.items.find((entry) => entry.productSlug === item.productSlug && entry.bundleId === item.bundleId);
      if (existing) {
        existing.quantity += 1;
      } else {
        slice.items.push({ ...item, quantity: 1 });
      }
    },
    removeItem(productSlug, bundleId) {
      slice.items = slice.items.filter((entry) => entry.productSlug !== productSlug || entry.bundleId !== bundleId);
    },
    setQuantity(productSlug, bundleId, quantity) {
      if (quantity <= 0) {
        slice.removeItem(productSlug, bundleId);
        return;
      }
      slice.items = slice.items.map((entry) =>
        entry.productSlug === productSlug && entry.bundleId === bundleId ? { ...entry, quantity } : entry
      );
    },
    clearCart() {
      slice.items = [];
      slice.checkout = initialCheckout;
    },
    setCartOpen(open) {
      slice.isCartOpen = open;
      if (open) slice.hasOpenedCart = true;
    },
    setCheckoutStep(step) {
      slice.checkout = { ...slice.checkout, step };
    },
    setPromoCode(promoCode) {
      slice.checkout = { ...slice.checkout, promoCode };
    },
    setCheckoutEmail(email) {
      slice.checkout = { ...slice.checkout, email };
    },
    setCheckoutRegion(region) {
      slice.checkout = { ...slice.checkout, region };
    },
    setShippingAddressId(shippingAddressId) {
      slice.checkout = { ...slice.checkout, shippingAddressId };
    },
    setBillingAddressId(billingAddressId) {
      slice.checkout = { ...slice.checkout, billingAddressId };
    },
    setCheckoutOrderMeta(meta) {
      slice.checkout = { ...slice.checkout, ...meta };
    },
    subtotal() {
      return summarizeCartTax(slice.items).subtotal;
    },
    taxTotal() {
      return summarizeCartTax(slice.items).taxTotal;
    },
    grandTotal() {
      return summarizeCartTax(slice.items).total;
    },
    itemCount() {
      return slice.items.reduce((sum, item) => sum + item.quantity, 0);
    }
  };

  return slice;
}

type CartStore = {
  items: CartItem[];
  checkout: CheckoutDraft;
  isCartOpen: boolean;
  hasOpenedCart: boolean;
  addItem: (item: NewCartItem) => void;
  removeItem: (productSlug: string, bundleId: string) => void;
  setQuantity: (productSlug: string, bundleId: string, quantity: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  setCheckoutStep: (step: CheckoutStep) => void;
  setPromoCode: (promoCode: string) => void;
  setCheckoutEmail: (email: string) => void;
  setCheckoutRegion: (region: string) => void;
  setShippingAddressId: (addressId: string) => void;
  setBillingAddressId: (addressId: string) => void;
  setCheckoutOrderMeta: (meta: Partial<Pick<CheckoutDraft, "paymentIntentId" | "orderId">>) => void;
  subtotal: () => number;
  taxTotal: () => number;
  grandTotal: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      checkout: initialCheckout,
      isCartOpen: false,
      hasOpenedCart: false,
      addItem(item) {
        set((state) => {
          const existing = state.items.find((entry) => entry.productSlug === item.productSlug && entry.bundleId === item.bundleId);
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.productSlug === item.productSlug && entry.bundleId === item.bundleId
                  ? { ...entry, quantity: entry.quantity + 1 }
                  : entry
              ),
              isCartOpen: true,
              hasOpenedCart: true
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }], isCartOpen: true, hasOpenedCart: true };
        });
      },
      removeItem(productSlug, bundleId) {
        set((state) => ({
          items: state.items.filter((entry) => entry.productSlug !== productSlug || entry.bundleId !== bundleId)
        }));
      },
      setQuantity(productSlug, bundleId, quantity) {
        if (quantity <= 0) {
          get().removeItem(productSlug, bundleId);
          return;
        }
        set((state) => ({
          items: state.items.map((entry) =>
            entry.productSlug === productSlug && entry.bundleId === bundleId ? { ...entry, quantity } : entry
          )
        }));
      },
      clearCart() {
        set({ items: [], checkout: initialCheckout });
      },
      setCartOpen(open) {
        set((state) => ({ isCartOpen: open, hasOpenedCart: state.hasOpenedCart || open }));
      },
      setCheckoutStep(step) {
        set((state) => ({ checkout: { ...state.checkout, step } }));
      },
      setPromoCode(promoCode) {
        set((state) => ({ checkout: { ...state.checkout, promoCode } }));
      },
      setCheckoutEmail(email) {
        set((state) => ({ checkout: { ...state.checkout, email } }));
      },
      setCheckoutRegion(region) {
        set((state) => ({ checkout: { ...state.checkout, region } }));
      },
      setShippingAddressId(shippingAddressId) {
        set((state) => ({ checkout: { ...state.checkout, shippingAddressId } }));
      },
      setBillingAddressId(billingAddressId) {
        set((state) => ({ checkout: { ...state.checkout, billingAddressId } }));
      },
      setCheckoutOrderMeta(meta) {
        set((state) => ({ checkout: { ...state.checkout, ...meta } }));
      },
      subtotal() {
        return summarizeCartTax(get().items).subtotal;
      },
      taxTotal() {
        return summarizeCartTax(get().items).taxTotal;
      },
      grandTotal() {
        return summarizeCartTax(get().items).total;
      },
      itemCount() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      }
    }),
    {
      name: "mithron-aero-cart",
      partialize: (state) => ({
        items: state.items,
        checkout: state.checkout
      })
    }
  )
);
