# Dead Code Audit — Manual Review Queue

Items flagged by knip/depcheck that were **not** removed. Each row was traced against tests, `package.json` scripts, dynamic imports, and `ENTERPRISE_CLEANUP_DEPENDENCIES`.

## Unused files (knip) — keep until contract tests migrate

| Item | Dynamic import? | Test reference? | npm script? | Env flag? | Verdict |
|------|-----------------|-------------------|-------------|-----------|---------|
| `components/admin/enterprise-realtime-panel.tsx` | No | Yes (`enterprise-realtime-reliability.test.ts`, `final-enterprise-security-hardening.test.ts`) | No | No | **REVIEW** — source contract; not mounted in app |
| `components/supplier/supplier-frame.tsx` | No | Yes (`supplier-portal.test.ts`, `logout-csrf.test.ts`, e2e `supplier.spec.ts`) | No | No | **REVIEW** — e2e expects `[data-supplier-frame]` |
| `components/warehouse/warehouse-frame.tsx` | No | Yes (`warehouse-panel-implementation.test.ts`, `logout-csrf.test.ts`) | No | No | **REVIEW** — contract tests read file |
| `sections/product/product-media-viewer.tsx` | No | Yes (`media-bandwidth-optimization.test.ts`) | No | No | **REVIEW** — contract test reads implementation |

**Action:** Either wire these into layouts or refactor tests to target the components that actually ship (e.g. `PlatformShell`).

## Unused exports (114) — sample high-risk categories

| Area | Count (approx) | Verdict | Notes |
|------|----------------|---------|-------|
| `app/admin/cms/actions.ts` server actions | 11 | **REVIEW** | May be bound via forms/CMS workspace not traced by knip |
| `app/admin/settings/actions.ts` | 2 | **REVIEW** | Form actions |
| `app/warehouse/actions.ts` | several | **REVIEW** | Warehouse workflow actions |
| `lib/glass-ui.ts` helpers | 3 | **REVIEW** | Used via `glassButtonClassName`; other exports may be dead |
| `config/cms-deprecations.ts` duplicates | 2 pairs | **GATED** | Listed in enterprise cleanup; do not remove |
| `lib/editor/prepare-html.ts` duplicates | 2 | **REVIEW** | Intentional display/save variants |

Full export list: `automated-findings.json` → `knip.exports`.

## Dependencies (depcheck false positives — do not remove)

| Package | Verdict | Reason |
|---------|---------|--------|
| `@tailwindcss/postcss` | **RUNTIME** | PostCSS pipeline |
| `tailwindcss` | **RUNTIME** | Tailwind v4 |
| `supabase` | **RUNTIME** | CLI in npm scripts / local dev |

## Tools and scripts (`tools/`, `scripts/`)

| Item | Verdict | Notes |
|------|---------|-------|
| `tools/**` (~92 files) | **REVIEW** | Excluded from knip `project`; many invoked via `package.json` one-offs |
| `scripts/remove-backgrounds-upload.cmd` | **REVIEW** | Still calls removed `upload-to-supabase.mjs` — update or remove cmd wrapper |
| `scripts/remove-backgrounds.cmd` | **RUNTIME** | Documents Python workflow |
| `tools/prune-vercel-aliases.mjs` | **REVIEW** | Untracked duplicate mentioned in plan; verify script reference |

## Database

| Item | Verdict | Notes |
|------|---------|-------|
| All 113 migrations | **RUNTIME** | No DROP TABLE/COLUMN in this audit |
| Suspected unused columns | **REVIEW** | Document only; grep `services/` + RPCs before any schema change |

## Enterprise cleanup gates (`ENTERPRISE_CLEANUP_DEPENDENCIES`)

| Path | Gate | Verdict |
|------|------|---------|
| `config/storefront-content.ts` | cmsParity | **GATED** |
| `config/cms-deprecations.ts` | cmsParity | **GATED** |
| CMS fallback consumers in `services/cms.ts` | cmsParity | **GATED** |

`destructiveCleanupAllowed: false` — no bypass.

## Deprecated but still referenced

| Symbol / path | Verdict |
|---------------|---------|
| `services/checkout-stock.ts` | **REVIEW** — `@deprecated`, grep before removal |
| `lib/currency.ts` aliases | **REVIEW** |
| `app/api/upload/route.ts` (410) | **RUNTIME** — retirement test requires route |

## CSS modules

| Item | Verdict |
|------|---------|
| `.reveal` / `.revealVisible` in `product-showcase.module.css` | **REVIEW** — classes from removed reveal sections; safe to prune in a CSS-only follow-up after grep |
