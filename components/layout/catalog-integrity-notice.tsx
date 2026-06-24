import type { CatalogDataError } from "@/services/catalog";

export function CatalogIntegrityNotice({ errors }: { errors: CatalogDataError[] }) {
  if (!errors.length) return null;

  return (
    <div
      role="alert"
      data-catalog-integrity-notice
      className="border-b border-amber-200/80 bg-amber-50 px-4 py-3 text-[#7c2d12]"
    >
      <div className="mx-auto flex w-full max-w-[1740px] flex-col gap-2">
        <p className="text-sm font-semibold tracking-tight">Catalog data needs attention</p>
        <p className="text-sm text-[#9a3412]">
          {errors.length === 1
            ? "One published product is hidden from navigation because its source image is missing."
            : `${errors.length} published products are hidden from navigation because source images are missing.`}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[#9a3412]">
          {errors.map((error) => (
            <li key={error.slug}>
              <span className="font-medium">{error.slug}</span>
              <span className="text-[#b45309]"> — {error.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CatalogDataErrorPanel({
  error,
  title = "This product listing could not load.",
  description = "The product is published, but Mithron could not resolve its source image. Fix the catalog media link or unpublish the listing."
}: {
  error: CatalogDataError;
  title?: string;
  description?: string;
}) {
  return (
    <main data-catalog-data-error className="min-h-[62vh] bg-[var(--surface-page)] px-6 py-24 text-[#0f172a]">
      <section className="mx-auto flex max-w-2xl flex-col justify-center">
        <p className="type-meta text-[#64748b]">Catalog data error</p>
        <h1 className="type-page mt-4">{title}</h1>
        <p className="type-body mt-5 max-w-xl text-[#64748b]">{description}</p>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#9a3412]">
          <span className="font-medium">{error.slug}</span>
          <span className="text-[#b45309]"> — {error.message}</span>
        </p>
      </section>
    </main>
  );
}
