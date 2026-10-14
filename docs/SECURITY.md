# Security model and known limitations

This document describes what is implemented, how it is tested, and what is **not** covered. It is a developer's account, not an independent audit; have the system reviewed before handling real customer or payment data at scale.

## Controls implemented

| Area | Control | Where | Tested by |
| --- | --- | --- | --- |
| Authentication | scrypt hashing (N=16384), per-user salt, uniform-time check for unknown emails; 12-character minimum | `src/server/passwords.ts`, `auth-core.ts` | `auth.test.ts` |
| Sessions | Random 256-bit token; only its SHA-256 is stored; httpOnly, SameSite=Lax, `Secure` in production; 8-hour absolute expiry; revoked on deactivation | `auth-core.ts`, `auth.ts` | `auth.test.ts`, e2e |
| Brute force | Per-account lockout (5 failures, 15 min), plus IP and account rate limits on sign-in | `auth-core.ts`, `admin/login/actions.ts` | `auth.test.ts` |
| Authorisation | Role matrix in one file; enforced in every server action, route handler and page; `/admin` also gated in `proxy.ts` (first gate only) | `src/lib/permissions.ts` | `admin.test.ts`, `workflow.test.ts`, e2e access-control specs |
| Least privilege | Managers cannot create managers or admins, edit services, areas or settings, or issue refunds; cleaners see and progress only their assigned jobs | `staff.ts`, `workflow.ts`, `catalog-admin.ts` | same |
| Input validation | Zod schemas on every public endpoint; size-capped JSON bodies; typed errors, no stack traces to clients | `booking-schema.ts`, `http.ts`, `action.ts` | `bookings.test.ts` |
| Do not trust the browser | Price, serviceability, capacity, status, roles and payment success are computed or verified server-side; unknown fields are ignored | `bookings.ts`, `workflow.ts`, `payments.ts` | `bookings.test.ts`, `payments.test.ts` |
| Customer privacy | Booking pages require reference **and** a secret token (HMAC-derived); a wrong token looks like "not found"; page sends `no-referrer` and `noindex` | `bookings.ts`, confirmation page | `bookings.test.ts`, e2e |
| Payments | Success only after server-to-provider verification of reference, amount and currency; DB check forbids an unverified "success"; webhook HMAC-SHA512 over the raw body, constant-time compare; unique event key makes replays no-ops; unique provider reference prevents double charges | `payments.ts`, `paystack.ts` | `payments.test.ts`, e2e (mock provider) |
| Double-booking | Advisory lock per slot; exclusion constraint on staff time ranges; idempotency key per submission | `bookings.ts`, `0001_constraints.sql` | concurrency tests in `bookings.test.ts`, `workflow.test.ts` |
| Auditability | Append-only `audit_logs` and `booking_status_history` (DB triggers reject UPDATE/DELETE) for status changes, quotations, payments, refunds, catalogue edits, user changes, moderation | `audit.ts`, migration | `auth.test.ts`, `admin.test.ts` |
| Abuse limits | Postgres-backed fixed-window rate limits on booking, availability, payment and customer-change endpoints | `rate-limit.ts` | `auth.test.ts` |
| CSRF | SameSite=Lax cookies, Next.js Origin checks on server actions, explicit same-origin check on cookie-less public JSON endpoints and the upload route | `http.ts` | e2e |
| Uploads | Admin-only; type decided by magic bytes (JPEG, PNG, WebP only; SVG refused); 1.5 MB cap; served with `nosniff` and a sandbox CSP | `media.ts`, `media/[id]/route.ts` | `features.test.ts`, `media-policy.test.ts`, e2e |
| Secrets | Server-only env vars; none are `NEXT_PUBLIC_`; `.env*` ignored by git (`.env.example` is committed) | `.gitignore` | review |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed | `next.config.ts` | e2e |
| Privacy | Logs avoid personal data (console email provider logs subjects only); IPs are keyed-hashed in rate-limit keys; cards never touch this app | `notifications.ts`, `crypto.ts` | review |
| Dependencies | `pnpm audit`: see below | | |

## Known limitations and risks

1. **No Content-Security-Policy.** A strict CSP needs per-request nonces for Next.js inline scripts; not implemented. The other headers above are set.
2. **No two-factor authentication, no self-service password change or reset.** Admins set passwords. Add these before many staff use the system.
3. **Account lockout can be abused** to lock a known staff email out for 15 minutes. This is a deliberate trade-off against password guessing.
4. **Rate limiting trusts `X-Forwarded-For`.** That is reliable on Vercel and most reverse proxies, but spoofable if the app is exposed directly. Deploy behind a trusted proxy.
5. **The booking link is a bearer secret.** Anyone who has the confirmation URL can view and change that booking (cancel, reschedule, accept a quotation). It is emailed and shown once. Treat emails accordingly.
6. **Paystack webhooks are authenticated by signature only** (no source-IP allowlist). Refunds are only *recorded* here; they are executed manually in Paystack.
7. **Database superusers can bypass the audit triggers.** Restrict production database roles; use a least-privilege application role (no `SUPERUSER`, no `TRUNCATE`).
8. **No row-level security.** All data access goes through the server with one database role. Do not expose the database to clients (do not use Supabase's public API with the anon key against these tables).
9. **Data retention is not automated.** Customer records, bookings and reviews are kept indefinitely until you define and implement a retention and deletion process (required for Nigeria Data Protection Act compliance).
10. **Uploaded images are not re-encoded or scanned**, only type-checked and size-limited, and only admins can upload.
11. **Failed notification emails are not retried automatically.**
12. **Paystack and Resend integrations were tested against mocks**, not the live services.

## Dependency audit (`pnpm audit`, run during development)

Two findings, both in **development-only tooling that is not deployed**:
- `braces` (high, no patched version) via `eslint-config-next` → `fast-glob`;
- `esbuild` (moderate, dev-server request exposure) via `drizzle-kit`'s bundled loader.

Neither is part of the production runtime. Re-run `pnpm audit` regularly and before launch.

## Reporting

Before launch, decide who receives security reports and publish a contact (for example `security@yourdomain`).
