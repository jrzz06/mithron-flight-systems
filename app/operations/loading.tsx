export default function OperationsLoading() {
  return (
    <main data-control-plane className="min-h-screen bg-[#07080a] px-4 py-5 text-white md:px-8" aria-label="Loading operations">
      <section className="mx-auto grid max-w-[1240px] gap-5">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.032] p-5">
          <div className="h-4 w-32 rounded bg-white/[0.08]" />
          <div className="mt-3 h-8 w-72 max-w-full rounded bg-white/[0.08]" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 rounded-xl border border-white/[0.08] bg-white/[0.025]" />
            ))}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-72 rounded-xl border border-white/[0.08] bg-white/[0.025]" />
          <div className="h-72 rounded-xl border border-white/[0.08] bg-white/[0.025]" />
        </div>
      </section>
    </main>
  );
}
