import { Suspense } from "react";
import { CartPageClient } from "./cart-page-client";

function CartPageSkeleton() {
  return (
    <main className="surface-page inner-page min-h-screen">
      <section className="mx-auto max-w-[960px]">
        <div className="h-10 w-32 animate-pulse rounded-lg bg-[var(--ds-skeleton)]" aria-hidden="true" />
        <div className="mt-8 grid gap-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[var(--ds-r-xl)] bg-[var(--ds-skeleton)]" aria-hidden="true" />
          ))}
        </div>
      </section>
    </main>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<CartPageSkeleton />}>
      <CartPageClient />
    </Suspense>
  );
}
