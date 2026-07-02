"use client";

import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { catalogCategoryDefinitions } from "@/lib/catalog-categories";
import {
  getFeaturedFromCatalogIndex,
  searchCatalogIndex,
  type CatalogSearchIndexEntry
} from "@/lib/catalog-search-index";
import type { CatalogSearchResult } from "@/services/catalog";
import { useUiStore } from "@/store/ui";
import { formatINR } from "@/lib/utils";

type IndexResponse = {
  index?: CatalogSearchIndexEntry[];
  error?: string;
};

type SearchResponse = {
  query: string;
  results: CatalogSearchResult[];
  error?: string;
};

export function SearchOverlay() {
  const overlay = useUiStore((state) => state.overlay);
  const setOverlay = useUiStore((state) => state.setOverlay);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [catalogIndex, setCatalogIndex] = useState<CatalogSearchIndexEntry[]>([]);
  const [indexReady, setIndexReady] = useState(false);
  const [fallbackResults, setFallbackResults] = useState<CatalogSearchResult[]>([]);
  const [isFallbackSearching, setIsFallbackSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeQuery = query.trim();
  const hasActiveQuery = activeQuery.length > 0;

  const effectiveDebouncedQuery = hasActiveQuery ? debouncedQuery : "";

  useEffect(() => {
    if (!hasActiveQuery) return;
    const timer = window.setTimeout(() => setDebouncedQuery(activeQuery), 150);
    return () => window.clearTimeout(timer);
  }, [activeQuery, hasActiveQuery]);

  const featuredProducts = useMemo(
    () => getFeaturedFromCatalogIndex(catalogIndex, 4),
    [catalogIndex]
  );
  const indexedResults = useMemo(
    () => (hasActiveQuery && catalogIndex.length ? searchCatalogIndex(catalogIndex, activeQuery, 24) : []),
    [activeQuery, catalogIndex, hasActiveQuery]
  );
  const visibleProducts = hasActiveQuery
    ? (catalogIndex.length ? indexedResults : (indexReady ? fallbackResults : []))
    : (indexReady ? featuredProducts : []);
  const promoProduct = useMemo(
    () => featuredProducts.find((product) => Boolean(product.badge)) ?? featuredProducts[0],
    [featuredProducts]
  );
  const open = overlay === "search";
  const isLoading = !indexReady || (hasActiveQuery && !catalogIndex.length && isFallbackSearching);
  const showEmptyState = !isLoading && !visibleProducts.length;
  const statusLabel = isLoading
    ? "Searching..."
    : `${visibleProducts.length} result${visibleProducts.length === 1 ? "" : "s"}`;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;

    queueMicrotask(() => {
      setQuery("");
      setCatalogIndex([]);
      setIndexReady(false);
      setFallbackResults([]);
      setSearchError(null);
      setIsFallbackSearching(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const controller = new AbortController();

    void fetch("/api/catalog/search?intent=index", {
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json() as IndexResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Search index failed.");
        }
        if (!active) return;
        setCatalogIndex(payload.index ?? []);
        setIndexReady(true);
        setSearchError(null);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setIndexReady(true);
        setSearchError(error instanceof Error ? error.message : "Search failed.");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !effectiveDebouncedQuery || catalogIndex.length || !indexReady) return;

    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      setIsFallbackSearching(true);
      setSearchError(null);
    });

    void fetch(`/api/catalog/search?q=${encodeURIComponent(effectiveDebouncedQuery)}&limit=24`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = await response.json() as SearchResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Search failed.");
        }
        if (!active) return;
        setFallbackResults(payload.results);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setSearchError(error instanceof Error ? error.message : "Search failed.");
        setFallbackResults([]);
      })
      .finally(() => {
        if (active) setIsFallbackSearching(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [catalogIndex.length, effectiveDebouncedQuery, indexReady, open]);

  return (
    <div
      className={`search-overlay-root fixed inset-0 z-[1001] ${open ? "is-open" : ""}`}
      aria-hidden={!open}
      aria-label="Search catalog"
      aria-modal={open ? "true" : undefined}
      role="dialog"
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        className="search-overlay-backdrop absolute inset-0 bg-black/88"
        aria-label="Dismiss search overlay"
        onClick={() => setOverlay(null)}
      />
      <div className="search-overlay-panel ambient-surface ambient-dark relative text-white shadow-[0_20px_60px_rgba(15,23,42,.24)]">
        <div className="mx-auto max-w-5xl px-6 py-9">
          <form
            className="flex items-center gap-4 border-b border-white/10 pb-4"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <Search className="size-7 text-white/70" aria-hidden="true" />
            <input
              ref={inputRef}
              autoFocus={open}
              aria-label="Search Mithron systems"
              name="q"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Mithron systems"
              tabIndex={open ? 0 : -1}
              className="h-12 flex-1 bg-transparent font-display text-2xl font-medium outline-none placeholder:text-white/40"
            />
            <button
              tabIndex={open ? 0 : -1}
              aria-label="Close search"
              onClick={() => setOverlay(null)}
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
            >
              <X className="size-7" />
            </button>
          </form>
          <div className="grid gap-8 py-7 md:grid-cols-[1.2fr_.72fr]">
            <section aria-labelledby="search-results-heading">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="search-results-heading" className="type-button text-sm text-white/40">
                  {hasActiveQuery ? "Matching systems" : "Featured systems"}
                </h2>
                <p className="type-meta text-white/40" aria-live="polite" aria-atomic="true">
                  {statusLabel}
                </p>
              </div>
              {(() => {
                if (isLoading && hasActiveQuery) {
                  return (
                    <div className="ambient-surface ambient-muted rounded-2xl border border-[var(--surface-border)] p-6">
                      <p className="type-body text-sm text-white/50">Searching catalog...</p>
                    </div>
                  );
                }

                if (visibleProducts.length) {
                  return (
                    <ul className="grid list-none gap-3 p-0 text-sm md:grid-cols-2">
                      {visibleProducts.map((product, productIndex) => (
                        <li key={product.slug}>
                          <Link
                            href={`/product/${product.slug}`}
                            title={`View ${product.name}`}
                            tabIndex={open ? 0 : -1}
                            onClick={() => setOverlay(null)}
                            className="search-result-card ambient-surface ambient-muted group grid min-h-28 grid-cols-[82px_1fr] items-center gap-4 rounded-2xl border border-[var(--surface-border)] p-3 outline-none focus-visible:ring-2 focus-visible:ring-white max-[767px]:min-h-[44px]"
                          >
                            <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
                              <MithronThumbImage
                                src={product.image.src}
                                alt={product.image.alt || product.name}
                                responsive={product.image.responsive}
                                fill
                                loading={productIndex < 4 ? "eager" : "lazy"}
                                priority={productIndex < 4}
                                className="object-contain p-2"
                                sizes="80px"
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="type-meta text-[10px] text-white/40">{product.category}</span>
                              <span className="type-card-title mt-1 block truncate text-base leading-5">{product.name}</span>
                              {product.tagline ? (
                                <span className="type-body mt-1 block line-clamp-2 text-xs text-white/45">{product.tagline}</span>
                              ) : null}
                              <span className="type-price mt-2 flex items-center justify-between gap-3 text-xs font-medium text-white/50 max-[390px]:flex-col max-[390px]:items-start max-[390px]:gap-1">
                                From {formatINR(product.price)}
                                <ArrowRight className="size-4 text-white/90" aria-hidden="true" />
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  );
                }

                if (!showEmptyState) return null;

                return (
                  <div className="ambient-surface ambient-muted rounded-2xl border border-[var(--surface-border)] p-6">
                    <p className="type-card-title text-xl">{searchError ? "Search unavailable" : "No exact mission match"}</p>
                    <p className="type-body mt-2 text-sm text-white/50">
                      {searchError ?? "Try agriculture, mapping, controller, safety sensor, or surveillance."}
                    </p>
                    {hasActiveQuery ? (
                      <Link
                        href={`/search?q=${encodeURIComponent(activeQuery)}`}
                        className="type-button mt-4 inline-flex text-sm text-white/70 underline-offset-4 hover:underline"
                        onClick={() => setOverlay(null)}
                      >
                        Open full search results
                      </Link>
                    ) : null}
                  </div>
                );
              })()}
            </section>
            <aside aria-labelledby="search-explore-heading">
              <h2 id="search-explore-heading" className="type-button mb-4 text-sm text-white/40">Explore more</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                {catalogCategoryDefinitions.map((category) => (
                  <Link
                    key={category.slug}
                    href={category.href}
                    title={`Browse ${category.label}`}
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOverlay(null)}
                    className="search-chip type-button inline-flex min-h-11 items-center rounded-full border border-[var(--surface-border)] bg-white/5 px-4 py-2"
                  >
                    {category.label}
                  </Link>
                ))}
              </div>
              {promoProduct ? (
                <Link
                  href={`/product/${promoProduct.slug}`}
                  title={`View ${promoProduct.name}`}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOverlay(null)}
                  className="ambient-surface ambient-dark mt-7 block rounded-2xl p-5 text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <p className="type-meta text-white/38">Popular search</p>
                  <h3 className="type-card-title mt-2 text-2xl">{promoProduct.name}</h3>
                  <p className="type-body mt-3 text-sm text-white/56">{promoProduct.tagline}</p>
                </Link>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
