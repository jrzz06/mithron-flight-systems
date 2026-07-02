"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";

export type ProductPurchaseActions = {
  addToCart: () => void;
  buyNow: () => void;
  isAdding: boolean;
};

const ProductPurchaseActionsContext = createContext<ProductPurchaseActions | null>(null);
const ProductPurchaseRegistrationContext = createContext<Dispatch<SetStateAction<ProductPurchaseActions | null>> | null>(
  null
);

export function ProductPurchaseProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ProductPurchaseActions | null>(null);
  const registration = useMemo(() => setActions, []);

  return (
    <ProductPurchaseActionsContext.Provider value={actions}>
      <ProductPurchaseRegistrationContext.Provider value={registration}>
        {children}
      </ProductPurchaseRegistrationContext.Provider>
    </ProductPurchaseActionsContext.Provider>
  );
}

export function useProductPurchaseActions() {
  return useContext(ProductPurchaseActionsContext);
}

export function useRegisterProductPurchase(actions: ProductPurchaseActions | null) {
  const register = useContext(ProductPurchaseRegistrationContext);

  useLayoutEffect(() => {
    if (!register) return;
    register(actions);
    return () => register(null);
  }, [actions, register]);
}
