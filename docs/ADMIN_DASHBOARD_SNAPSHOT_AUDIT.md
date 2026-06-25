# Admin Dashboard Snapshot Audit Report

**Date:** 2026-06-25  
**Scope:** `getAdminDashboardSnapshot()` and `app/admin/page.tsx`

## Hardcoded cards found

| Card / metric | Previous value | Issue |
|---------------|----------------|-------|
| **Supplier submissions** | `"Review queue"` (static string) | Placeholder text, not a count |
| **Customer enquiries** | `"Open queue"` (static string) | Placeholder text, not a count |
| **Orders awaiting review** | Derived from last 8 `recentOrders` via loose regex | Under-counted; missed orders outside recent window |
| **Low stock alerts** | `lowStockAlerts.length` (max 8 rows) | Capped to fetch limit, not total inventory risk |

## Replacements (live data sources)

| Metric | Data source | Query / method |
|--------|-------------|----------------|
| Orders awaiting review | Supabase `orders` | `HEAD` count: `status=in.(paid,admin_review,pending_payment)` |
| Low stock alerts | Supabase `inventory` | `HEAD` count: `stock_status=in.(low_stock,out_of_stock)` |
| Supplier submissions | Supabase `mithron_products` | `HEAD` count: `workflow_status=eq.pending_review` |
| Customer enquiries | Supabase `enquiries` + `orders` | Sum of `enquiries.status=eq.new` + `orders.channel=eq.enquiry&status=eq.admin_review` |
| Requires-action order rows | Supabase `orders` | `fetchAdminRows` filtered list: same status filter, `limit=8` |
| Low stock detail rows | Supabase `inventory` | Existing `lowStockInventory` query (unchanged, list only) |
| Recent orders / activity | Supabase | Existing dashboard queries (unchanged) |
| Table totals (`metrics`) | Supabase | Existing `countTable` for orders, products, inventory, notifications |

## Files modified

| File | Changes |
|------|---------|
| `services/admin.ts` | Added `countTableRows`, `operationalCounts`, `ordersNeedingReview`, `orderNeedsAdminReview`, `formatDashboardCount`; extended dashboard queries with `channel` |
| `app/admin/page.tsx` | Wired operational snapshot to live counts; fixed attention-queue logic; `force-dynamic`; empty states for recent orders |
| `docs/ADMIN_DASHBOARD_SNAPSHOT_AUDIT.md` | This report |
| `tests/admin-dashboard-snapshot.test.ts` | Regression tests for live operational counts |

## Behaviour notes

- **Loading:** `app/admin/loading.tsx` shows `ControlPlaneLoading` while the server component fetches snapshot data.
- **Failures:** Network or Supabase errors return `UNAVAILABLE` metrics; UI shows `—` via `formatDashboardCount()`. Row fetch failures surface `blockedReason` banner.
- **Empty data:** Zero counts render as `"0"`; lists show existing empty-state copy (`All clear`, `Inventory healthy`, etc.).
- **Freshness:** `export const dynamic = "force-dynamic"` on the dashboard page; layout is also dynamic. Each navigation re-fetches from Supabase.

## Not changed (intentionally)

- **Quick actions** — navigation links only (no metrics).
- **Admin shell nav badge** — already uses live `countPendingSupplierProducts()` in `AdminShell`.
