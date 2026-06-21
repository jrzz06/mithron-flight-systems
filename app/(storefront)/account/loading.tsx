import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <main className="surface-page min-h-screen px-6 py-28 md:px-16">
      <div className="mx-auto max-w-[1180px]">
        <Skeleton className="h-4 w-20 bg-white/10" />
        <Skeleton className="mt-3 h-10 w-56 bg-white/10" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="grid h-fit gap-2 rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-11 rounded-xl bg-white/10" />
            ))}
          </aside>
          <section className="rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-6">
            <Skeleton className="h-8 w-40 bg-white/10" />
            <Skeleton className="mt-6 h-48 bg-white/10" />
          </section>
        </div>
      </div>
    </main>
  );
}
