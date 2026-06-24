import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { catalogCategoryDefinitions } from "@/lib/catalog-categories";
import { buildSearchResultsItemListJsonLd } from "@/lib/structured-data";
import { formatINR } from "@/lib/utils";
import { searchCatalogProducts } from "@/services/catalog";
type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (query) {
    return {
      title: `Search results for "${query}"`,
      description: `Mithron catalog matches for ${query}: agriculture drones, mapping platforms, surveillance systems, and components.`,
      robots: {
        index: false,
        follow: true
      }
    };
  }

  return {
    title: "Search Drone Systems",
    description: "Search the Mithron catalog for agriculture drones, mapping platforms, surveillance systems, flight controllers, batteries, and mission components.",
    alternates: {
      canonical: "/search"
    },
    openGraph: {
      title: "Search Mithron Drone Systems",
      description: "Find professional drone aircraft, spares, and field-ready systems across agriculture, mapping, and surveillance missions."
    }
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchCatalogProducts(query, 48) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {query && results.length ? (
        <JsonLd data={buildSearchResultsItemListJsonLd(query, results)} />
      ) : null}
      <header className="max-w-2xl">        <p className="type-meta text-sm text-[#5f6b7a]">Catalog search</p>
        <h1 className="type-display mt-2 text-4xl font-semibold tracking-tight text-[#101828]">
          {query ? `Results for “${query}”` : "Search Mithron systems"}
        </h1>
        <p className="type-body mt-3 text-base text-[#475467]">
          {query
            ? `Showing ${results.length} published product${results.length === 1 ? "" : "s"} matching your query.`
            : "Search agriculture drones, mapping platforms, surveillance aircraft, controllers, batteries, and mission components."}
        </p>
      </header>

      {query ? (
        results.length ? (
          <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2">
            {results.map((product) => (
              <li key={product.slug}>
                <Link
                  href={`/product/${product.slug}`}
                  title={`View ${product.name}`}
                  className="group grid grid-cols-[88px_1fr] gap-4 rounded-2xl border border-[#e4e7ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.04)] transition hover:border-[#cfd4dc]"
                >
                  <span className="relative size-20 overflow-hidden rounded-xl bg-[#f2f4f7]">
                    <MithronThumbImage
                      src={product.image.src}
                      alt={product.image.alt || product.name}
                      responsive={product.image.responsive}
                      fill
                      loading="eager"
                      className="object-contain p-2"
                      sizes="80px"
                    />
                  </span>
                  <span>
                    <span className="type-meta text-[11px] uppercase tracking-[0.12em] text-[#667085]">{product.category}</span>
                    <span className="type-card-title mt-1 block text-lg text-[#101828]">{product.name}</span>
                    {product.tagline ? (
                      <span className="type-body mt-1 block line-clamp-2 text-sm text-[#475467]">{product.tagline}</span>
                    ) : null}
                    <span className="type-price mt-2 block text-sm font-medium text-[#344054]">From {formatINR(product.price)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <section className="mt-10 rounded-2xl border border-[#e4e7ec] bg-white p-8">
            <h2 className="type-card-title text-2xl text-[#101828]">No exact mission match</h2>
            <p className="type-body mt-2 text-sm text-[#475467]">
              Try agriculture, mapping, controller, battery, or surveillance keywords, or browse a category below.
            </p>
          </section>
        )
      ) : (
        <section className="mt-10 rounded-2xl border border-[#e4e7ec] bg-[#f8fafc] p-8">
          <h2 className="type-card-title text-xl text-[#101828]">Browse by mission</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {catalogCategoryDefinitions.map((category) => (
              <Link
                key={category.slug}
                href={category.href}
                title={`Browse ${category.label}`}
                className="rounded-full border border-[#d0d5dd] bg-white px-4 py-2 text-sm text-[#344054] hover:border-[#98a2b3]"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
