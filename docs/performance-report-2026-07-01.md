# Mithron Storefront Performance Report

**Date:** 2026-07-01  
**Baseline:** [performance-baseline-2026-07-01.md](./performance-baseline-2026-07-01.md)

## Optimizations shipped

### High impact
- **Scoped `/products` showroom load** — parallel per-category fetches instead of full `getProducts()` catalog scan ([`services/catalog.ts`](services/catalog.ts))
- **Interest pages** — Supabase `interests` filter instead of loading entire catalog
- **PDP loader** — `cache()`-wrapped `loadProductForPage` shared by metadata + page; parallel primary/cutout media lookups
- **PDP reviews** — streamed via async `ProductReviewsAsyncSection` inside Suspense
- **Cart pricing dedup** — shared Zustand store with in-flight request coalescing ([`store/cart-pricing.ts`](store/cart-pricing.ts))
- **Deferred cart pricing fetch** — only when cart drawer is open
- **Checkout** — parallel stock verification + pricing lookup
- **Route skeletons** — `loading.tsx` for product, search, and category routes

### Medium impact
- **Search** — 150ms debounced API fallback; idle search index prewarm; first 4 result thumbs eager only
- **Product gallery** — render active slide ±1 only (reduced DOM/paint)
- **CLS** — `aspect-ratio` on `.featureMedia`
- **Nav LCP** — brand mark `priority` on storefront nav
- **Bundle** — expanded `optimizePackageImports` for `sonner` and `@tanstack/react-virtual`
- **Purchase context** — split handlers vs `isAdding` to reduce sticky bar churn

### Validation added
- [`tests/cart-pricing-store.test.ts`](../tests/cart-pricing-store.test.ts) — in-flight dedup contract
- [`tests/e2e/storefront-perf.spec.ts`](../tests/e2e/storefront-perf.spec.ts) — navigation, search, add-to-cart responsiveness smoke

## Expected improvements

| Area | Expected change |
|------|-----------------|
| `/products` TTFB | Lower — no full-catalog pagination |
| PDP TTFB | Lower — deduped loader + parallel media |
| Cart pricing API | 1 request per cart change (shared store) |
| Search fallback | Fewer API calls (debounce) |
| PDP memory | Lower — virtualized gallery layers |
| CLS on feature media | Improved — reserved aspect ratio |

## Post-deploy verification

Re-run on local prod build and production:

```bash
npm run build && npm start
npx lighthouse https://final-mithron-deploy.vercel.app/ --only-categories=performance
npm test
npm run e2e -- tests/e2e/storefront-perf.spec.ts
```

## Production TTFB sample (post-optimization code, pre-deploy)

| Route | Before TTFB | Post-change sample |
|-------|-------------|-------------------|
| `/` | 1.36s | 1.26s |
| `/products` | 1.31s | 1.12s |
| `/search?q=drone` | 1.11s | 1.07s |

Deploy to production and re-run Lighthouse for full CWV validation.
