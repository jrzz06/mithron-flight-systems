import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading checkout" className="surface-section-cool min-h-screen px-6 py-28 md:px-16">
      <div className="mx-auto max-w-[920px]">
        <Skeleton className="h-8 w-48 bg-white/10" />
        <Skeleton className="mt-3 h-12 w-full max-w-xl bg-white/10" />
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 bg-white/10" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-[24px] bg-white/10" />
        </div>
      </div>
      <span className="sr-only">Loading checkout form.</span>
    </div>
  );
}
