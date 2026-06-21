export function HomeLandingSkeleton() {
  return (
    <section
      aria-hidden="true"
      data-testid="home-landing-skeleton"
      className="mx-auto w-full max-w-[1440px] animate-pulse px-4 py-10 md:px-6"
    >
      <div className="mb-8 h-4 w-40 rounded bg-white/10" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-48 rounded-2xl bg-white/8 md:col-span-2" />
        <div className="grid gap-4">
          <div className="h-24 rounded-xl bg-white/8" />
          <div className="h-24 rounded-xl bg-white/8" />
        </div>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="h-56 rounded-2xl bg-white/8" />
        <div className="h-56 rounded-2xl bg-white/8" />
      </div>
    </section>
  );
}
