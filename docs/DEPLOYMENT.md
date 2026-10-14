# Deployment guide

Target: **Vercel** (app) + **managed PostgreSQL** (for example Supabase, Neon or any Postgres 14+). Nothing here has been deployed from this repository yet; follow the checklist and verify each step.

## 1. Database

1. Create a Postgres database. Use a dedicated application role with `SELECT, INSERT, UPDATE, DELETE` on the tables and **no** superuser or `TRUNCATE` rights for runtime. Use a separate, more privileged role only to run migrations.
2. The migrations enable the `btree_gist` extension (needed for the staff-overlap constraint). Confirm your provider allows `CREATE EXTENSION btree_gist`; on Supabase also confirm the exclusion constraint creates successfully (this was not tested on Supabase).
3. Apply migrations from your machine or CI using the **direct** (non-pooled) connection string:
   ```bash
   DATABASE_URL="postgres://migrator:...@host:5432/postgres" pnpm db:migrate
   ```
4. Seed once (demonstration catalogue and first admin). Replace the demo data in the admin dashboard immediately, or skip the demo catalogue by editing `scripts/seed.ts`:
   ```bash
   DATABASE_URL=... SEED_ADMIN_EMAIL=you@yourdomain SEED_ADMIN_PASSWORD='a-long-unique-password' pnpm db:seed
   ```
5. For the running app use the **pooled** connection string. On Supabase's transaction pooler (port 6543) set `DATABASE_PREPARE=false`. Serverless functions open many short connections, so keep `DATABASE_POOL_MAX` small (for example 3 to 5).

Migrations are the only way schema changes reach production. Never edit production tables by hand; change `src/server/db/schema.ts`, run `pnpm db:generate`, review the SQL, commit, and apply.

## 2. Vercel project

1. Import the GitHub repository. Framework preset: Next.js. Build command `pnpm build`, install `pnpm install`.
2. Set environment variables for **Production** (see `.env.example`):
   - `NEXT_PUBLIC_SITE_URL` (the real https URL), `NEXT_PUBLIC_SITE_NAME`, contact details, `NEXT_PUBLIC_DEMO_MODE=false` once real data is in place
   - `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_PREPARE`
   - `APP_SECRET` (32+ random characters; changing it invalidates existing customer booking links, so set it once and keep it)
   - `PAYSTACK_SECRET_KEY` (live key for production; test key for preview)
   - `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (a verified sender on your domain)
   - leave `BOOKING_RATE_LIMIT` at its default (8 per 10 minutes) unless you have a reason
3. **The build needs database access**, because service pages and the sitemap read the catalogue at build time. Make sure the database is reachable from Vercel's build environment and already migrated and seeded before the first deploy.
4. Region: pick the Vercel region closest to the database (and to Lagos users where possible).

## 3. Paystack

1. In the Paystack dashboard set the **webhook URL** to `https://<your-domain>/api/webhooks/paystack`.
2. Use test keys first: run a complete booking, confirm it in the admin, pay with a Paystack test card from the customer page, and check that the payment shows as verified in `/admin/payments`.
3. Replay a webhook from the dashboard and confirm the balance does not change a second time.
4. Switch to live keys only after this passes. Refunds must be completed in the Paystack dashboard after you record them in the app.

## 4. Email

Verify your sending domain with the provider (SPF and DKIM), set `EMAIL_PROVIDER=resend`, then book a test request with your own email and confirm that the "request received" message arrives with a working link.

## 5. Before launch

- [ ] Replace all demonstration data (services, prices, areas, time slots, contact details) and set `NEXT_PUBLIC_DEMO_MODE=false`.
- [ ] Complete and professionally review `/privacy`, `/terms`, `/cancellation-policy` and set the customer change notice window in **Areas & hours**.
- [ ] Upload real service photos; leave the gallery and reviews empty until genuine content exists.
- [ ] Create named staff accounts; remove or change the seeded admin credentials.
- [ ] Run `pnpm audit`, `pnpm test:all`, `pnpm e2e` against a staging copy.
- [ ] Measure the deployed site (`node scripts/perf.mjs https://your-domain`, plus Lighthouse).
- [ ] Set up database backups and test a restore.
- [ ] Schedule a job to retry failed notifications and purge old rate-limit rows (not built; see README).
- [ ] Decide data retention and a deletion process for customer data.

## 6. Operations

- **Monitoring**: watch Vercel function logs for `Unhandled error:` lines (messages only, no personal data) and check `/admin/payments` for payments stuck in `pending`.
- **Audit**: `/admin/audit` shows the latest 200 sensitive actions; the full history is in the `audit_logs` table.
- **Rollback**: application rollbacks are a Vercel redeploy. Database migrations here are forward-only, so take a backup before applying one.
- **Secrets rotation**: rotate `PAYSTACK_SECRET_KEY` and `RESEND_API_KEY` in Vercel and redeploy. Rotating `APP_SECRET` breaks existing booking links.
