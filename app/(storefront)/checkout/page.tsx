import { Suspense } from "react";
import { CheckoutPageClient } from "./checkout-page-client";
import CheckoutLoading from "./loading";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutPageClient />
    </Suspense>
  );
}
