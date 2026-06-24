# Project Overview

## Purpose of the system

Mithron Flight Systems is a full-stack web platform for selling and operating drone products. It combines a public e-commerce storefront with internal workspaces for administration, warehouse fulfillment, supplier collaboration, and field operations. The project README describes it as a Next.js storefront and admin platform for Mithron drone systems.

## Problem being solved

The platform closes the gap between a product catalog website and the back-office processes required to run a drone commerce business: catalog management, stock control, order fulfillment, supplier onboarding, customer enquiries, payments, and website content management. It replaces or supplements a prior Wix-based storefront through catalog migration and reconciliation tooling.

## Target users

- Retail customers browsing and purchasing drones, accessories, and services (e.g., Mithron Care+)
- Administrators managing the business end-to-end
- Warehouse staff fulfilling orders and managing stock
- Supplier partners submitting and maintaining product listings
- Internal operations staff (admin-only workspace) coordinating deployments, tasks, and notifications

---

# System Architecture

## High-level architecture

The application is a single Next.js 16 monolith using the App Router. Business logic lives in a services layer; user interface components and route-specific pages sit under the app directory. Route protection and session handling run through a dedicated proxy module. The database schema is defined in 83 Supabase SQL migrations with Row Level Security policies.

At a high level, user clients (storefront, admin panel, warehouse workspace, supplier portal, and operations workspace) interact with Next.js pages, REST API routes, and server actions. These connect to Supabase for authentication, PostgreSQL data, object storage, and realtime updates. External services handle payments (Razorpay), email (Resend), rate limiting (Upstash Redis), and Wix catalog reconciliation tooling.

## Main technologies used

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16, React 19, TypeScript 6 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth with cookie-based SSR |
| State | Zustand (cart, UI) |
| Payments | Razorpay (production); stub gateway for local development |
| Email | Resend |
| Rate limiting | Upstash Redis |
| Testing | Vitest (161 test files), Playwright E2E |
| Deployment | Vercel (final-mithron-deploy); Docker alternative |
| CI | GitHub Actions (lint, typecheck, test, build) |

---

# User Roles

The system defines four canonical roles: admin, warehouse, supplier, and user.

| Role | Label in UI | Primary workspace | Responsibilities |
|------|-------------|-------------------|------------------|
| admin | Admin workspace | /admin, /operations | Full system access: products, inventory, media, orders, CMS, users, reports, audit, supplier review, operations |
| warehouse | Warehouse operations | /warehouse | Order fulfillment, picking, packing, dispatch, shipments, stock movements, transfers, returns |
| supplier | Supplier portal | /supplier | Product submission, editing own listings, supplier stock levels |
| user | Customer hub | /account | Checkout, payments, enquiries, order history, addresses, profile |

Additional notes verified from the codebase:

- Customer is a UI label; the database role key is user.
- Operations is an admin-only route group (/operations/*), not a separate role. The legacy operations_manager alias maps to user.
- Investigator role does not exist anywhere in the codebase.
- Staff roles (admin, warehouse, supplier) are confined away from casual storefront browsing; they access /account/security for account management.

---

# Major Modules and Pages

## Public storefront

- Homepage with CMS-driven hero, shelves, and product landing
- Product catalog (/products), category pages (/category/[slug], legacy routes such as /agriculture and /mapping)
- Product detail pages (/product/[slug], plus /product/mithron-care-plus)
- Cart, checkout, contact/enquiry, about
- Customer account: orders, addresses, enquiries, profile, security

## Admin panel (16 pages)

- Overview dashboard, products, inventory, media library, orders, suppliers, supplier submissions, enquiries
- CMS (homepage editor and visual workspace)
- Reports (sales, revenue, inventory, suppliers, warehouses)
- Audit log, user/team governance, settings

## Operations workspace (admin only)

- Overview, orders, field deployment requests, staff tasks, notifications

## Warehouse workspace (14 pages)

- Today dashboard, orders, fulfillment hub, picking, packing, dispatch, shipments
- Inventory, movements, transfers, returns, activity history, settings

## Supplier portal

- Overview, product list, new/edit submissions, stock levels

## Authentication

- Login, signup, forgot/reset password, onboarding (pending role assignment), invite acceptance

---

# Workflow

## Customer purchase flow

1. Customer browses the storefront catalog by category or search.
2. Products are added to the cart.
3. At checkout, the customer provides contact details and shipping address (guest or signed-in).
4. The system creates an order draft, reserves stock via a database function, and initiates a payment intent.
5. Payment is completed through Razorpay in production, or a local stub gateway in development only.
6. On payment confirmation via webhook, the order moves to a paid or confirmed state.
7. The customer can track orders and enquiries in /account.

## Enquiry flow (non-purchase)

1. Customer submits an enquiry via the contact form or checkout enquiry path.
2. Enquiry is stored with status tracking (new through converted).
3. Admin reviews and assigns enquiries in /admin/enquiries.

## Admin product and content flow

1. Admin creates or edits products in /admin/products, including variants, SEO, and tax groups.
2. Media is managed through the canonical media library (/admin/media); the legacy upload API is retired by default.
3. Website content (heroes, navigation, footer, FAQs, reviews, campaigns) is edited in /admin/cms with draft/publish workflow and revision history.

## Supplier flow

1. Supplier logs into /supplier.
2. Submits new products or edits existing submissions.
3. Admin reviews submissions in /admin/suppliers/products (approve or reject).

## Warehouse fulfillment flow

1. Paid orders appear in the warehouse order queue.
2. Staff picks items (/warehouse/picking), packs them (/warehouse/packing), and dispatches (/warehouse/dispatch).
3. Shipments are created with timeline tracking; stock is deducted on fulfillment via database functions.
4. Returns and stock transfers are handled in dedicated warehouse pages.
5. Inventory movements are archived monthly via a Vercel cron job.

## User governance flow

1. Admin invites or creates users in /admin/users or settings.
2. New users without a role land on /onboarding until an admin assigns a role.
3. Admin can disable accounts or revoke sessions.

---

# Key Features Implemented

## Fully implemented

- Public storefront with catalog, search API, cart, and checkout
- Razorpay payment integration with webhooks and pending-payment expiry cron
- Guest and authenticated checkout with stock reservation
- Customer account (orders, addresses, enquiries, profile)
- Role-based access control across four roles with route guards and permission checks
- Admin product catalog management with supplier workflow and merge audit
- CMS with homepage editor, content revisions, and publish/draft states
- Media library with Supabase storage buckets and responsive image pipeline
- Warehouse fulfillment pipeline (picking, packing, dispatch, shipments)
- Inventory management with movements ledger, CSV import, and warehouse stock
- Supplier product submission and admin approval workflow
- Operations module (deployment requests, staff tasks, notifications)
- Reports hub (sales, revenue, inventory, suppliers, warehouses)
- Audit and security observability (activity logs, security events, CSP reporting)
- Email notifications via Resend with dispatch cron
- Distributed rate limiting via Upstash Redis
- Extensive test coverage (161 Vitest files, Playwright E2E suites for storefront, admin, warehouse, supplier, CMS, SEO)
- Production hardening (environment validation, security headers, error boundaries, observability hooks)
- Docker deployment option with health checks
- Wix catalog fetch and sync tooling for migration parity

## Partially implemented

- CMS cutover: Remote Supabase CMS is active for many surfaces, but fallback local content still protects navigation, hero banners, and other surfaces when remote data is missing or invalid. Diagnostics report a PARTIAL status.
- Stripe payments: Environment variables and gateway types exist; no dedicated Stripe service implementation file. Razorpay is the implemented provider.
- Twilio SMS: A service file exists; environment documentation states it is not wired to workflows yet.
- Enterprise cleanup: A readiness framework tracks legacy fallback dependencies (local CMS content, generated media manifests) that are marked safe to remove only after parity and rollback gates pass.
- Legacy data: The orders.items JSON column is marked deprecated in favor of the order_items table.

## Not present in the codebase

- Investigator role or module
- Separate operations_manager role (legacy alias only)
- tRPC, Prisma, or Drizzle ORM
- Supabase Edge Functions directory

---

# Database and Integrations

## Databases

- Supabase PostgreSQL with 83 SQL migrations
- Key entity groups: products and catalog, orders and payments, inventory and warehouse, shipments, CMS content, RBAC (roles, permissions, user roles), audit and activity logs, notifications, deployment requests, staff tasks
- Row Level Security on sensitive tables
- Database functions for stock reservation, fulfillment, product search, CMS mutations with revision, log pruning, and movement archiving

## Storage

- Public buckets: mithron-hero, mithron-products, mithron-cms, mithron-interests, mithron-story, mithron-thumbnails, mithron-editorial
- Private bucket: mithron-warehouse-documents

## External services

- Supabase: Auth, database, storage, realtime subscriptions
- Razorpay: Production payment processing
- Resend: Transactional email
- Upstash Redis: API rate limiting
- Wix Stores API: Catalog reconciliation tooling (not a runtime dependency)
- Vercel: Hosting, cron jobs, Speed Insights

## Deployment platforms

- Primary: Vercel project final-mithron-deploy (canonical URL: https://final-mithron-deploy.vercel.app)
- Alternative: Docker multi-stage build with standalone Next.js output
- CI: GitHub Actions on push and pull request to main; optional nightly Playwright E2E when STAGING_URL is configured
- Cron jobs (Vercel): Log pruning (weekly), inventory movement archiving (monthly)

---

# Security

## Authentication and access control

- Four-role RBAC (admin, warehouse, supplier, user) enforced at the page level through a session proxy and at the action level through permission checks.
- Staff roles are isolated from the admin shell unless they hold the admin role; warehouse and supplier users are redirected to their own workspaces.
- Session idle timeout is configurable (default 60 minutes).
- Account governance supports disabling users and revoking sessions via profile fields (governance_status, session_revoked_at).
- New users without an assigned role are held on an onboarding page until an administrator provisions access.

## API and data protection

- All 21 API routes are classified and tested for required security controls: rate limiting, session auth, bearer secrets, or dev-only restrictions (verified by api-route-security-contract tests).
- Public endpoints (checkout, enquiries, catalog search, login) use distributed rate limiting via Upstash Redis in production.
- Cron and internal routes require bearer secrets (CRON_SECRET, PAYMENT_EXPIRE_SECRET, NOTIFICATION_DISPATCH_SECRET).
- Supabase Row Level Security policies govern database access; service-role reads require explicit permission checks in application code.
- Stub payment webhooks are blocked on deployed environments; Razorpay credentials are required for production checkout.

## Application hardening

- Production startup validates required environment variables and fails fast if secrets, payment keys, email, or Redis are missing (assertProductionRuntimeConfig).
- ALLOW_DEMO_SEED cannot be enabled in production.
- Content Security Policy with nonce-based script loading; CSP violation reporting endpoint.
- HTML sanitization for product and CMS content; dangerous CMS link schemes are blocked.
- Timing-safe secret comparison for webhooks and bearer tokens.
- Security observability: audit logs, activity logs, security events, and REST/RLS denial telemetry.
- Storage: public buckets for storefront media only; private bucket for warehouse documents; SVG uploads blocked server-side.
- Secrets hygiene verification script (npm run security:verify-secrets) runs in CI.
- Docker health check on /api/health; production security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).

---

# Testing and Production Readiness

## Automated test coverage

| Layer | Count | Tool | Scope |
|-------|-------|------|-------|
| Unit and integration | 161 test files | Vitest | Security, RBAC, checkout, payments, CMS, catalog, inventory, warehouse, supplier workflows |
| End-to-end | 9 spec files | Playwright | Storefront, product, admin, warehouse, supplier, CMS, SEO, images |
| CI gate | All of the above | GitHub Actions | lint, typecheck, test, build on every push/PR to main |

Production-focused test suites include:

- production-readiness — error boundaries, observability wiring, metadata, security headers
- production-runtime-config — blocks demo seed and missing production env vars
- production-security-hardening — stub payment blocking, CSP, CMS href sanitization
- production-commerce-hardening — checkout schema validation, stock reservation contracts
- production-stabilization-readiness — enterprise cleanup gates, admin surface hygiene
- final-enterprise-security-hardening — admin shell isolation, session revocation, upload API retirement

## Product-specific tests

Twenty-four Vitest files cover product behavior directly, including:

- Catalog validation, pricing, tax groups, variants, SEO forms, and publish workflow
- Product detail content, responsive layout, reviews, HTML sanitization, and media linking
- Admin product forms, merge RPC, merge audit RLS, inventory workflow, and reconcile scoring
- Wix catalog client and catalog parity cleanup

Playwright product E2E (tests/e2e/product.spec.ts) verifies on a live deployment:

- Products catalog shell loads with visible inventory
- Catalog cards navigate to product detail pages
- PDP shows name, price, and purchase CTA
- Homepage product shelves render live catalog cards
- Category pages load product grids
- Cart drawer and add-to-cart flows

Separate E2E suites cover admin, warehouse, supplier, CMS, SEO, images, and general storefront navigation. Production E2E can be run against the deployed URL via npm run e2e:prod with dedicated scripts per area.

## Minimal load testing

A load-test runner exists (npm run test:load) using autocannon with a native-fetch fallback. It runs approximately 10 minutes across three scenarios:

| Scenario | Concurrent connections | Duration per scenario |
|----------|------------------------|------------------------|
| Baseline | 100 | ~200 seconds |
| Production | 500 | ~200 seconds |
| Peak stress | 1000 | ~200 seconds |

Routes exercised: homepage, /api/health, product catalog, category page, and a sample product detail page.

A recorded run (20 June 2026, against local dev server at http://127.0.0.1:3000) completed all three scenarios. The health API showed the lowest error rate at baseline (approximately 4%). Storefront HTML routes reported high timeout/error rates under sustained concurrency on the local machine (memory usage reached 96–99% during the run). This indicates the load tooling is in place for repeatability, but local results should not be treated as production capacity benchmarks. A markdown report can be generated from results via npm run test:load:report. The dev load-test API route is restricted to non-production environments.

## Production deployment suitability

**Ready for production (verified in code and CI):**

- Vercel deployment linked (final-mithron-deploy) with standalone Next.js build
- Production env validation at startup (payments, email, Redis, Supabase, site URL)
- Razorpay as configured payment provider; stub payments disabled on Vercel
- CI pipeline passes lint, typecheck, 161 unit tests, and production build
- Error boundaries, observability hooks, and health endpoint for monitoring
- Vercel cron jobs for log pruning and inventory movement archiving
- Docker alternative with health check for self-hosted deployment
- SECURITY.md documents secrets handling, API auth patterns, and storage policy

**Gaps before declaring full production hardening complete:**

- CMS and media fallback systems still active (PARTIAL cutover status)
- Twilio SMS not integrated into notification workflows
- Stripe gateway not implemented (Razorpay only)
- Load testing not yet recorded against the Vercel production URL
- Nightly Playwright E2E in CI requires STAGING_URL to be configured
- Enterprise cleanup gates (media parity, rollback recovery) remain blocked in readiness tests

**Overall assessment:** The platform meets the minimum bar for production deployment of core commerce and operations workflows, with automated security and regression tests enforcing critical paths. Remaining items are migration cutover completion, optional integrations, and production-environment load validation rather than missing core functionality.

---

# My Contributions

This report is presented as a team project deliverable. The repository contains 37 commits on a single branch. No AUTHORS or CONTRIBUTORS file is present, and package.json has an empty author field.

---

# Challenges and Improvements

## Technical challenges identified

- Production deployment stability: Multiple commits addressed Vercel runtime errors, including an HTML sanitization library change and TypeScript/build fixes.
- CMS migration safety: Maintaining storefront availability during Supabase CMS cutover required per-surface fallback logic rather than a hard switch.
- Media pipeline complexity: A large tooling surface (approximately 110 scripts) for asset optimization, Wix parity, canonical media backfill, and responsive delivery.
- Security surface area: API routes are not protected by the page-level proxy; each route must enforce its own authentication, as documented in SECURITY.md.
- Stock concurrency: Checkout requires coordinated stock reservation and release via database functions to prevent overselling.

## Improvements made

- Storefront performance audit, image fade-in, and smooth scrolling
- Product detail page redesign with improved gallery, reviews, and related products
- Mobile homepage and hero layout refinements
- Typography system (Inter and Outfit)
- Security hardening and secrets hygiene verification
- Legacy upload API retirement in favor of admin media library
- Guest enquiry verification with client audit tokens
- Catalog browse parity restoration

---

# Current Project Status

## Completed functionality

- End-to-end e-commerce: catalog, cart, checkout, payment, order tracking
- Full admin, warehouse, supplier, and operations workspaces
- RBAC with four roles, invite-based provisioning, session governance
- CMS, media library, reports, audit logging
- Production deployment configuration (Vercel and Docker)
- CI pipeline with lint, typecheck, 161+ unit tests, and build verification

## Remaining work

- Complete CMS parity verification and remove local fallback content dependencies
- Complete canonical media parity and staged removal of generated manifest fallbacks
- Wire Twilio SMS into notification workflows (service exists, not integrated)
- Implement Stripe gateway if multi-provider payments are required (configuration only today)
- Deprecate legacy orders.items column after migration
- Verify enterprise cleanup readiness gates in production before removing fallback systems

## Deployment status

- Linked to Vercel project final-mithron-deploy (https://final-mithron-deploy.vercel.app)
- Production URL configured in environment documentation
- Recent commits addressed Vercel runtime errors (sanitization library, build fixes), indicating active production maintenance
- GitHub Actions CI runs security verification, lint, typecheck, 161 unit tests, and build on every push/PR
- Nightly Playwright E2E conditional on STAGING_URL repository variable
- Minimal load-test tooling present; last recorded run was against local dev, not production
- Security controls (RBAC, rate limiting, CSP, production env validation) implemented and covered by automated tests

---

# Conclusion

Mithron Flight Systems is a production-oriented drone e-commerce platform that unifies a customer-facing storefront with administrative, warehouse, supplier, and field-operations workspaces. Built on Next.js and Supabase, it covers the full commercial lifecycle from product discovery and payment through inventory management and shipment fulfillment. The codebase includes layered security controls, 161 unit tests and 9 Playwright E2E suites (including dedicated product tests), minimal load-test tooling, and CI-gated production builds. Core business workflows are implemented and suitable for production deployment with Razorpay payments and Vercel hosting. Remaining work centers on completing CMS and media migration cutovers, running load tests against the production URL, optional SMS integration, and retiring legacy fallback systems once parity is verified.
