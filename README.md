# Coxbow

A cleaning-service website and operations platform for the Nigerian market: customers discover services, book or request a quotation, pay online, and manage their own booking; staff run everything from a role-based admin dashboard.

> **Status: working application, not yet launched.** All business content (prices, service areas, contact details, copy for legal pages, photos) is **demonstration data** until the business replaces it. See [Remaining tasks](#remaining-tasks-and-business-decisions).

## What it does

**Customers**
- Browse services; each service page is rendered from the database (inclusions, exclusions, extra charges, pricing guidance, FAQs, related services, optional photo, approved reviews).
- Five-step booking flow with validation and a progress indicator: service and property, location and schedule, contact details, price or quotation review, confirmation.
- Prices are an **estimate** until staff approve; jobs that need inspection become a **quotation request**. A booking reference is shown only after the server has saved the request.
- A private confirmation page (reference + secret link) to track status, accept or decline a quotation, **pay online (Paystack)**, **reschedule or cancel** within the business's notice window, and leave a **review** once the job is complete.

**Staff** (`/admin`, roles: admin, manager, cleaner)
- Dashboard with live metrics (new requests, pending quotations, confirmed, today's jobs, completed, cancelled, verified revenue, outstanding balance).
- Bookings: search and filter, approve or reject, send and revise quotations, confirm, reschedule, cancel, assign cleaners, progress jobs, internal notes, payment status.
- Services (details, pricing models, add-ons, categories, photos), service areas, time slots and capacity, booking rules.
- Customers, staff accounts and availability, payments (manual payments, refunds, reconciliation), review moderation, and an append-only audit log.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, design tokens in `src/app/globals.css`, Lucide icons. Components are hand-built using the shadcn/ui conventions (`cva`, `tailwind-merge`); the shadcn CLI is not used. |
| Data | PostgreSQL 16, Drizzle ORM, SQL migrations in `drizzle/` |
| Validation | Zod, on every server entry point |
| Auth | Built-in: scrypt password hashes, hashed server-side sessions, httpOnly cookies, lockout. No external auth service. |
| Payments | Paystack (initialize, verify, signed webhook) |
| Email | Console (development) or Resend |
| Tests | Vitest (unit, integration), Playwright with Chrome (e2e, accessibility) |

Supabase is supported as a **managed Postgres host**; this app does not use Supabase Auth or Storage.

## Quick start

Requirements: Node 20+ (developed on 24), pnpm, Docker (for local Postgres).

```bash
pnpm install
cp .env.example .env.local          # then edit: set APP_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
pnpm db:up                           # local Postgres on port 54329
pnpm db:migrate                      # apply migrations
pnpm db:seed                         # demonstration catalogue + first admin
pnpm dev                             # http://localhost:3000
```

`APP_SECRET` must be at least 32 random characters (`openssl rand -base64 48`). Sign in at `/admin/login` with the seeded admin.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build, serve |
| `pnpm typecheck` / `pnpm lint` | Static checks |
| `pnpm test` | Unit tests (pure business rules) |
| `pnpm test:integration` | Integration tests against the **test** database (`DATABASE_URL_TEST`) |
| `pnpm e2e` | Resets the test database, builds, runs Playwright on desktop, tablet and mobile sizes plus accessibility checks |
| `pnpm db:generate` | Generate a migration after editing `src/server/db/schema.ts` |
| `pnpm db:migrate` / `db:migrate:test` | Apply migrations |
| `pnpm db:seed` | Idempotent demo data and first admin |
| `node scripts/perf.mjs <url>` | Measure LCP, CLS and JS weight on throttled mobile against a running production server |

Test databases are separate from development. `tests/e2e/prepare.ts` refuses to run unless the database name contains "test".

## Architecture

```
src/
  app/
    (site)/          public pages: home, services, book, confirmation, legal, ...
    admin/           login + (panel)/ protected dashboard pages and server actions
    api/             route handlers: bookings, availability, payments, webhooks, media upload
    media/[id]/      public service photos
  components/        ui/ (design system), site/, home/, booking/, admin/
  lib/               PURE business rules shared by client and server (pricing, status
                     transitions, phone, service area, availability, permissions, schemas)
  server/            server-only logic: bookings, workflow, payments, auth, notifications,
                     catalogue, media, reviews, customer changes, rate limiting
    db/              Drizzle schema, client, demo-catalogue seeding
  data/              demonstration catalogue and FAQ copy
  proxy.ts           /admin session gate + real 404s for unknown services
drizzle/             SQL migrations (init, constraints, media)
scripts/             migrate, seed, perf
tests/               unit, integration, e2e
docs/                DEPLOYMENT.md, SECURITY.md
```

Principles: business rules are pure functions in `src/lib` and are unit-tested; everything with side effects lives in `src/server` and takes a database handle, so it is integration-tested against real Postgres; pages and routes are thin.

### Key design decisions
- **The server decides.** Price, serviceability, slot capacity, booking status and payment success are computed or verified server-side. Fields the browser sends for these are ignored.
- **Money** is integer kobo with an explicit currency. Each booking stores a snapshot of the agreed scope and price, so later catalogue edits never change history.
- **Concurrency**: slot capacity is protected by a Postgres advisory lock; staff double-booking is blocked by a database exclusion constraint; duplicate submissions by an idempotency key; duplicate payments by a unique provider reference; replayed webhooks by a unique event key.
- **Status lifecycle** (`src/lib/booking-status.ts`): `requested → quoted → confirmed → scheduled → in_progress → completed`, with `rejected` and `cancelled` exits. Nothing becomes confirmed without staff approval, and quotation jobs need an accepted quotation.
- **Time**: all business dates and slots are interpreted in `Africa/Lagos` (UTC+1, no daylight saving).
- **Caching**: public catalogue reads use `'use cache'` tagged `catalog` (and `reviews`); admin edits call `updateTag`.

## Pricing models

Configured per service in the admin: fixed price, price by property size (tiers), base price plus add-ons, inspection-based quotation, custom corporate quotation. Inspection and corporate services never show a price; they create a quotation request.

## Environment variables

See [`.env.example`](.env.example). Everything secret is server-only; only `NEXT_PUBLIC_*` values reach the browser, and those are non-secret site details.

## Verified results

Last full run on the development machine:

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint .` | clean |
| Unit tests | 42 passed |
| Integration tests (real Postgres) | 81 passed |
| End-to-end tests (Chrome; desktop 1280, tablet 820, mobile 390; plus axe WCAG A/AA scan of 10 pages) | 115 passed |
| Production build | passes (needs a reachable database at build time) |
| Mobile performance (390px, 1.6 Mbps, 150 ms RTT, 4x CPU slowdown) | LCP 0.72 to 0.90 s, CLS ≤ 0.01, about 158 to 166 KB compressed JavaScript per page |

These are results from local runs, not a deployment or a Lighthouse audit. Re-measure after deploying.

Payments were tested against **a mock Paystack** (the real request and response shapes from Paystack's documentation), not live Paystack. Email was tested with a mock provider, not Resend.

## Completed features

Public site and design system; dynamic service pages; five-step booking and quotation flow; server-side availability, capacity and conflict prevention; admin dashboard with role-based access; booking workflow, quotations, assignment, rescheduling, cancellation; services, pricing, add-ons, categories, areas, time slots, rules, photos; staff and availability; customers; Paystack payments (initialize, verify, signed webhook, idempotency), manual payments, refunds ledger, reconciliation; email notifications; customer self-service (pay, reschedule, cancel, review); review moderation; audit log; SEO basics (titles, canonical URLs, sitemap, robots, real 404s); accessibility checks; tests.

## Remaining tasks and business decisions

**Business decisions needed (nothing is invented; all are configurable placeholders now)**
- Company name, logo, contact numbers, WhatsApp number, address, hours, social links.
- Real services, prices, size tiers, add-ons, areas and neighbourhoods, time slots and crew capacity.
- Cancellation and rescheduling policy: notice window (admin setting, default 24 hours), fees, refund timing. The legal pages (`/privacy`, `/terms`, `/cancellation-policy`) are **drafts with bracketed gaps and need professional review**, including Nigeria Data Protection Act obligations.
- Real photos, before-and-after projects and customer reviews. Nothing is shown as a testimonial until a real, approved review exists.
- Paystack account and keys; email provider and sending domain.

**Engineering follow-ups (not built)**
- A scheduled job (cron) to retry failed notifications and purge old rate-limit rows. Failed emails are recorded as `failed` but not retried automatically.
- WhatsApp is click-to-chat links only; there is no automated WhatsApp sending.
- Refunds are **recorded** in the app; the money must be refunded in the Paystack dashboard.
- Reschedule by a customer keeps the booking's status; there is no re-approval step.
- Photo storage is Postgres (`media` table, 1.5 MB cap, JPEG/PNG/WebP). Move to object storage if the gallery grows. There is no public project gallery yet; `/gallery` shows an honest empty state.
- No staff password reset or two-factor sign-in. Passwords are set by an admin; users cannot yet change their own.
- Run an accessibility review with real assistive technology; automated checks find only part of the issues.
- Run a Lighthouse/WebPageTest pass on the deployed site.

See [`docs/SECURITY.md`](docs/SECURITY.md) for the security model and known limitations and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for going live.
