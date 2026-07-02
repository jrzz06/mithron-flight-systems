# Dead Code Audit — After Metrics

Captured: 2026-07-02 (post-cleanup)

## Comparison to baseline

| Metric | Before | After | Delta |
|--------|-------:|------:|------:|
| Git-tracked files | ~1,280 | ~1,269 | ~−32 |
| LOC (ts/tsx/js/mjs/cjs/css/sql) | ~140,499 | ~139,045 | ~−1,454 |
| App pages | 79 | 79 | 0 |
| API routes | 38 | 38 | 0 |
| Migrations | 113 | 113 | 0 |
| `dependencies` | 38 | 38 | 0 |
| `devDependencies` | 20* | 20* | 0 |
| Knip unused files | 28 | **4** | −24 removed |
| Knip unused exports | 114 | 114 | 0 (not targeted) |

\*Includes `knip` and `depcheck` added during audit.

## Build

| Metric | Value |
|--------|-------|
| `npm run build` | **PASS** (~82s wall clock) |
| Turbopack compile | ~22.4s |
| TypeScript phase | ~27.8s |

Bundle analyzer (`npm run analyze`) not run — optional follow-up.

## Tooling added (retained)

| Artifact | Purpose |
|----------|---------|
| `knip.json` | Next/Vitest/Playwright entry allowlists |
| `tools/dead-code-audit.mjs` | Knip + depcheck → `automated-findings.json` |
| `npm run audit:dead-code` | Repeatable scan |
| `npm run audit:knip` / `audit:depcheck` | Individual scanners |

## Enterprise cleanup

- `destructiveCleanupAllowed: false` — unchanged
- Gated paths (`config/storefront-content.ts`, etc.) — unchanged

## Remaining dead-code surface

- **4** unused files (all test-referenced contract sources) — see `review-queue.md`
- **114** unused exports — mostly server actions; require form/route tracing
- **0** unused npm packages (after depcheck false-positive filter)
