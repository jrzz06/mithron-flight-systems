"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartItem } from "@/config/types";
import {
  buildOptimisticCartLines,
  cartLinesMatchPersisted,
  mergeCartDisplayWithPricing
} from "@/lib/cart-display";
import { summarizeCartTax } from "@/lib/product-tax";
import { useCartStore } from "@/store/cart";

type CartPricingResponse = {
  lines: CartItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
};

export function useResolvedCart() {
  const persistedItems = useCartStore((state) => state.items);
  const [resolvedItems, setResolvedItems] = useState<CartItem[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [pricingChanged, setPricingChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousTotalRef = useRef<number | null>(null);

  const resolvePricing = useCallback(async () => {
    if (!persistedItems.length) {
      setResolvedItems([]);
      setPricingChanged(false);
      setError(null);
      previousTotalRef.current = null;
      return true;
    }

    setIsResolving(true);
    setError(null);

    try {
      const response = await fetch("/api/cart/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: persistedItems }),
        cache: "no-store"
      });
      const payload = (await response.json()) as CartPricingResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load current cart pricing.");
      }

      const previousTotal = previousTotalRef.current;
      if (previousTotal !== null && Math.abs(previousTotal - payload.total) > 0.009) {
        setPricingChanged(true);
      } else {
        setPricingChanged(false);
      }
      previousTotalRef.current = payload.total;
      setResolvedItems(payload.lines);
      return true;
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to load current cart pricing.");
      return false;
    } finally {
      setIsResolving(false);
    }
  }, [persistedItems]);

  useEffect(() => {
    void resolvePricing();
  }, [resolvePricing]);

  const hasResolvedPricing = useMemo(
    () => resolvedItems.length > 0 && !error && cartLinesMatchPersisted(persistedItems, resolvedItems),
    [persistedItems, resolvedItems, error]
  );

  const displayLines = useMemo(() => buildOptimisticCartLines(persistedItems), [persistedItems]);

  const items = useMemo(() => {
    if (!displayLines.length) return [];
    if (!hasResolvedPricing) return displayLines;
    return mergeCartDisplayWithPricing(displayLines, resolvedItems);
  }, [displayLines, hasResolvedPricing, resolvedItems]);

  const pricing = useMemo(() => summarizeCartTax(hasResolvedPricing ? resolvedItems : []), [hasResolvedPricing, resolvedItems]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const pricesPending = persistedItems.length > 0 && !hasResolvedPricing;

  return {
    items,
    resolvedItems,
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
    refreshPricing: resolvePricing,
    clearPricingChanged: () => setPricingChanged(false)
  };
}
