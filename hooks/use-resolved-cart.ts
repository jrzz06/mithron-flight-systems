"use client";

import { useEffect, useMemo } from "react";
import type { CartItem } from "@/config/types";
import {
  buildOptimisticCartLines,
  cartLinesMatchPersisted,
  mergeCartDisplayWithPricing
} from "@/lib/cart-display";
import { summarizeCartTax } from "@/lib/product-tax";
import { useCartStore } from "@/store/cart";
import { useCartPricingStore } from "@/store/cart-pricing";

type UseResolvedCartOptions = {
  enabled?: boolean;
};

export function useResolvedCart(options: UseResolvedCartOptions = {}) {
  const enabled = options.enabled ?? true;
  const persistedItems = useCartStore((state) => state.items);
  const snapshot = useCartPricingStore((state) => state.snapshot);
  const fetchPricing = useCartPricingStore((state) => state.fetchPricing);
  const clearPricingChanged = useCartPricingStore((state) => state.clearPricingChanged);

  useEffect(() => {
    if (!enabled) return;
    void fetchPricing(persistedItems);
  }, [enabled, fetchPricing, persistedItems]);

  const resolvedItems = snapshot.lines;
  const isResolving = enabled ? snapshot.isResolving : false;
  const error = enabled ? snapshot.error : null;
  const pricingChanged = enabled ? snapshot.pricingChanged : false;

  const hasResolvedPricing = useMemo(
    () =>
      enabled
      && resolvedItems.length > 0
      && !error
      && cartLinesMatchPersisted(persistedItems, resolvedItems),
    [enabled, persistedItems, resolvedItems, error]
  );

  const displayLines = useMemo(() => buildOptimisticCartLines(persistedItems), [persistedItems]);

  const items = useMemo(() => {
    if (!displayLines.length) return [];
    if (!hasResolvedPricing) return displayLines;
    return mergeCartDisplayWithPricing(displayLines, resolvedItems);
  }, [displayLines, hasResolvedPricing, resolvedItems]);

  const pricing = useMemo(
    () => summarizeCartTax(hasResolvedPricing ? resolvedItems : []),
    [hasResolvedPricing, resolvedItems]
  );
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const pricesPending = persistedItems.length > 0 && !hasResolvedPricing;

  const refreshPricing = async () => {
    if (!enabled) return true;
    await fetchPricing(persistedItems);
    return !useCartPricingStore.getState().snapshot.error;
  };

  return {
    items,
    resolvedItems: hasResolvedPricing ? resolvedItems : ([] as CartItem[]),
    persistedItems,
    subtotal: pricing.subtotal,
    taxTotal: pricing.taxTotal,
    grandTotal: pricing.total,
    itemCount,
    isResolving,
    pricesPending,
    hasResolvedPricing,
    pricingChanged,
    error,
    refreshPricing,
    clearPricingChanged
  };
}
