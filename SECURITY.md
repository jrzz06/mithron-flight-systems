# Security

## Secrets and credentials

- Never commit `.env`, `.env.local`, or `.env.*` files. `.gitignore` excludes them.
- Use `.env.example` as the template for required variables only — no real values.
- **Production:** set secrets in your deployment platform (Vercel, Railway, etc.). The app calls `assertProductionRuntimeConfig()` at startup in production and will fail fast if required variables are missing.
- **Local development:** `.env.local` is for your machine only. Do not expose it over the network or copy it into production images.
- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, payment keys, and other secrets immediately if they were ever committed to git.

Verify `.env.local` is ignored:

```bash
npm run security:verify-secrets
```

Or manually:

```bash
git check-ignore -v .env.local
git log --all --full-history -- .env.local
```

## API route protection

Page routes (`/admin`, `/warehouse`, `/supplier`, `/account`, etc.) are RBAC-gated in `proxy.ts`.

**Every new `/api/*` route must enforce its own authentication and authorization.** Middleware does not protect API routes. Use:

- `createClient()` + `getClaims()` / `getUser()` for session auth
- `requirePermission()` for RBAC
- `safeBearerEquals()` for cron/internal bearer secrets
- `checkDistributedRateLimit()` for abuse-sensitive endpoints

## Service-role reads

`fetchAdminRecordsByColumn` bypasses RLS. Pass `requiredPermission` when calling it from user-facing code, or use an authenticated Supabase client for reads that should respect RLS.

## Media routes

Mission image routes only serve allowlisted filenames from `public/media/...`. Dev-only Cursor asset fallbacks are disabled in production.
