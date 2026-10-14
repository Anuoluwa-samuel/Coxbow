import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { bookings, customers, paymentEvents, payments, refunds } from "./db/schema";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { verifyWebhookSignature, type PaystackClient } from "./paystack";
import { can } from "@/lib/permissions";
import type { SessionUser } from "./auth-core";

type Actor = Pick<SessionUser, "id" | "role">;

const PAYABLE = ["confirmed", "scheduled", "in_progress", "completed"] as const;

/** Paid so far (verified successes minus refunds) for a booking, in kobo. */
export async function paymentSummary(db: Db, bookingId: string) {
  const [b] = await db.select({ finalKobo: bookings.finalKobo }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  const [paid] = await db
    .select({ n: sql<number>`coalesce(sum(${payments.amountKobo}),0)::int` })
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), sql`${payments.status} IN ('success','partially_refunded','refunded')`));
  const [ref] = await db
    .select({ n: sql<number>`coalesce(sum(${refunds.amountKobo}),0)::int` })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(eq(payments.bookingId, bookingId));
  const netPaid = paid.n - ref.n;
  return { finalKobo: b?.finalKobo ?? null, paidKobo: paid.n, refundedKobo: ref.n, netPaidKobo: netPaid, outstandingKobo: b?.finalKobo == null ? null : Math.max(0, b.finalKobo - netPaid) };
}

/**
 * Starts an online payment for the AGREED price only. The amount comes from the database, never
 * from the browser. Requires the customer's private booking token.
 */
export async function initializePayment(db: Db, client: PaystackClient, reference: string, token: string | undefined, siteUrl: string) {
  const [row] = await db
    .select({ b: bookings, email: customers.email })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(eq(bookings.reference, reference))
    .limit(1);
  if (!token || !row || !safeEqual(sha256(token), row.b.accessTokenHash)) throw new AppError("not_found", "Booking not found");
  const b = row.b;
  if (!(PAYABLE as readonly string[]).includes(b.status) || b.finalKobo == null) throw new AppError("conflict", "This booking is not ready for payment yet.");
  if (!row.email) throw new AppError("validation", "An email address is needed to pay online. Please contact us to add one.");
  const summary = await paymentSummary(db, b.id);
  if (!summary.outstandingKobo) throw new AppError("conflict", "This booking is already paid.");

  const payRef = `CXP-${randomToken(9)}`;
  await db.insert(payments).values({ bookingId: b.id, provider: "paystack", reference: payRef, amountKobo: summary.outstandingKobo, currency: "NGN", status: "pending" });
  const { authorizationUrl } = await client.initialize({
    email: row.email, amountKobo: summary.outstandingKobo, reference: payRef,
    callbackUrl: `${siteUrl}/book/confirmation/${encodeURIComponent(reference)}?t=${encodeURIComponent(token)}`,
  });
  return { authorizationUrl, paymentReference: payRef };
}

export type VerifyOutcome = "success" | "failed" | "pending" | "already_processed" | "mismatch";

/**
 * The ONLY place a payment becomes successful. Asks the provider (authenticated by our secret key)
 * for the truth and checks reference, currency and amount against OUR record. Idempotent: running
 * it again, or concurrently, can never credit a payment twice.
 */
export async function verifyAndApplyPayment(db: Db, client: PaystackClient, paymentReference: string, now = new Date()): Promise<VerifyOutcome> {
  const [existing] = await db.select().from(payments).where(and(eq(payments.provider, "paystack"), eq(payments.reference, paymentReference))).limit(1);
  if (!existing) throw new AppError("not_found", "Payment not found");
  if (existing.status !== "pending") return "already_processed";

  const remote = await client.verify(paymentReference);

  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, existing.id)).for("update").limit(1);
    if (p.status !== "pending") return "already_processed" as const;
    if (remote.reference !== p.reference) return "mismatch" as const;

    if (remote.status === "success") {
      if (remote.amount !== p.amountKobo || remote.currency !== p.currency) {
        await writeAudit(tx, null, "payment.mismatch", "payment", p.id, { expected: p.amountKobo, got: remote.amount, currency: remote.currency });
        return "mismatch" as const;
      }
      await tx.update(payments).set({ status: "success", paidAt: now, verifiedAt: now, providerTransactionId: remote.id ? String(remote.id) : null, updatedAt: now }).where(eq(payments.id, p.id));
      await writeAudit(tx, null, "payment.verified", "payment", p.id, { bookingId: p.bookingId, amountKobo: p.amountKobo });
      return "success" as const;
    }
    if (remote.status === "failed" || remote.status === "abandoned" || remote.status === "reversed") {
      await tx.update(payments).set({ status: "failed", updatedAt: now }).where(eq(payments.id, p.id));
      return "failed" as const;
    }
    return "pending" as const;
  });
}

/**
 * Handles a Paystack webhook. Order matters: authenticate the signature over the RAW body, record the
 * event under a unique key (replays become no-ops), then confirm with the provider before changing state.
 */
export async function handlePaystackWebhook(db: Db, client: PaystackClient, rawBody: string, signature: string | null, now = new Date()) {
  if (!verifyWebhookSignature(rawBody, signature)) throw new AppError("unauthorized", "Invalid signature");
  let event: { event?: string; data?: { id?: number; reference?: string } };
  try { event = JSON.parse(rawBody); } catch { throw new AppError("validation", "Invalid payload"); }
  if (!event.event || !event.data) throw new AppError("validation", "Invalid payload");

  const eventKey = `${event.event}:${event.data.id ?? event.data.reference ?? sha256(rawBody)}`;
  const [inserted] = await db
    .insert(paymentEvents)
    .values({ provider: "paystack", eventKey, eventType: event.event, payload: event as object })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });

  let eventId = inserted?.id;
  if (!eventId) {
    const [prior] = await db.select().from(paymentEvents).where(and(eq(paymentEvents.provider, "paystack"), eq(paymentEvents.eventKey, eventKey))).limit(1);
    if (prior.processedAt) return { duplicate: true as const };
    eventId = prior.id; // received earlier but not finished: safe to retry because processing is idempotent
  }

  if (event.event === "charge.success" && event.data.reference) {
    const [known] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.provider, "paystack"), eq(payments.reference, event.data.reference))).limit(1);
    if (known) await verifyAndApplyPayment(db, client, event.data.reference, now);
  }
  await db.update(paymentEvents).set({ processedAt: now }).where(eq(paymentEvents.id, eventId));
  return { duplicate: false as const };
}

/** Staff records money received outside Paystack (cash or bank transfer). Verified by the staff member. */
export async function recordManualPayment(db: Db, actor: Actor, bookingId: string, amountKobo: number, note: string, now = new Date()) {
  if (!can(actor.role, "payments.record")) throw new AppError("forbidden", "You do not have permission to do that");
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) throw new AppError("validation", "Enter a valid amount", { amountKobo: ["Must be positive"] });
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update").limit(1);
    if (!b) throw new AppError("not_found", "Booking not found");
    if (b.finalKobo == null) throw new AppError("conflict", "Agree a final price before recording payment");
    const s = await paymentSummary(tx as unknown as Db, bookingId);
    if (amountKobo > (s.outstandingKobo ?? 0)) throw new AppError("validation", "Amount is more than the outstanding balance", { amountKobo: ["Exceeds outstanding balance"] });
    const [p] = await tx.insert(payments).values({
      bookingId, provider: "manual", reference: `MAN-${randomToken(9)}`, amountKobo, status: "success", paidAt: now, verifiedAt: now,
    }).returning();
    await writeAudit(tx, actor.id, "payment.manual_recorded", "payment", p.id, { bookingId, amountKobo, note: note.slice(0, 200) });
    return p;
  });
}

/** Records a refund against a verified payment. Admin only. Executing the refund at Paystack is a separate manual step. */
export async function recordRefund(db: Db, actor: Actor, paymentId: string, amountKobo: number, reason: string) {
  if (!can(actor.role, "payments.refund")) throw new AppError("forbidden", "You do not have permission to do that");
  if (!reason.trim()) throw new AppError("validation", "A reason is required", { reason: ["Required"] });
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update").limit(1);
    if (!p) throw new AppError("not_found", "Payment not found");
    if (!["success", "partially_refunded"].includes(p.status) || !p.verifiedAt) throw new AppError("conflict", "Only verified, successful payments can be refunded");
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(sum(${refunds.amountKobo}),0)::int` }).from(refunds).where(eq(refunds.paymentId, paymentId));
    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0 || amountKobo > p.amountKobo - n) throw new AppError("validation", "Invalid refund amount", { amountKobo: ["Exceeds refundable amount"] });
    const [r] = await tx.insert(refunds).values({ paymentId, amountKobo, reason: reason.trim().slice(0, 500), createdBy: actor.id }).returning();
    await tx.update(payments).set({ status: n + amountKobo === p.amountKobo ? "refunded" : "partially_refunded", updatedAt: new Date() }).where(eq(payments.id, paymentId));
    await writeAudit(tx, actor.id, "payment.refund_recorded", "payment", paymentId, { amountKobo, refundId: r.id });
    return r;
  });
}

export async function markReconciled(db: Db, actor: Actor, paymentId: string, reconciled: boolean) {
  if (!can(actor.role, "payments.record")) throw new AppError("forbidden", "You do not have permission to do that");
  await db.update(payments).set({ reconciled, updatedAt: new Date() }).where(eq(payments.id, paymentId));
  await writeAudit(db, actor.id, reconciled ? "payment.reconciled" : "payment.unreconciled", "payment", paymentId);
}
