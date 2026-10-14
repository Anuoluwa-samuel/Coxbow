import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { bookingStatusHistory, bookings, services } from "./db/schema";
import { fetchBookingSettings } from "./catalog-db";
import { isValidDateString } from "./availability";
import { AppError } from "./errors";
import { safeEqual, sha256 } from "./crypto";
import { paymentSummary } from "./payments";
import { rescheduleInTx, transitionInTx } from "./workflow";
import type { BookingStatus } from "@/lib/booking-status";

/** Customers may reschedule at most this many times themselves; after that they contact the business. */
export const MAX_CUSTOMER_RESCHEDULES = 2;
const CHANGEABLE: readonly BookingStatus[] = ["requested", "quoted", "confirmed", "scheduled"];

export type ChangeEligibility =
  | { ok: true; hoursLeft: number }
  | { ok: false; reason: "status" | "too_late" | "paid" | "reschedule_limit" };

/** Pure policy: can the customer change this booking themselves right now? */
export function evaluateCustomerChange(input: { status: BookingStatus; startsAt: Date; now: Date; noticeHours: number; netPaidKobo: number; priorReschedules: number }, kind: "cancel" | "reschedule"): ChangeEligibility {
  if (!CHANGEABLE.includes(input.status)) return { ok: false, reason: "status" };
  const hoursLeft = (input.startsAt.getTime() - input.now.getTime()) / 3_600_000;
  if (hoursLeft < input.noticeHours) return { ok: false, reason: "too_late" };
  // Money has changed hands: a human must handle any refund, so the customer is asked to get in touch.
  if (kind === "cancel" && input.netPaidKobo > 0) return { ok: false, reason: "paid" };
  if (kind === "reschedule" && input.priorReschedules >= MAX_CUSTOMER_RESCHEDULES) return { ok: false, reason: "reschedule_limit" };
  return { ok: true, hoursLeft };
}

const REASON_TEXT: Record<Exclude<ChangeEligibility, { ok: true }>["reason"], string> = {
  status: "This booking can no longer be changed online.",
  too_late: "It is too close to the start time to change this online. Please contact us.",
  paid: "A payment has been made on this booking, so please contact us to cancel and arrange any refund.",
  reschedule_limit: "This booking has already been rescheduled the maximum number of times. Please contact us.",
};

async function loadOwned(db: Db, reference: string, token: string | undefined) {
  if (!token) throw new AppError("not_found", "Booking not found");
  const [b] = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1);
  if (!b || !safeEqual(sha256(token), b.accessTokenHash)) throw new AppError("not_found", "Booking not found");
  return b;
}

async function priorReschedules(db: Db, bookingId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(bookingStatusHistory)
    .where(and(eq(bookingStatusHistory.bookingId, bookingId), sql`${bookingStatusHistory.note} LIKE 'Customer rescheduled%'`));
  return r.n;
}

/** Used by the confirmation page to decide which controls to show. Never throws for a valid owner. */
export async function customerChangeOptions(db: Db, bookingId: string, b: { status: BookingStatus; startsAt: Date }, now = new Date()) {
  const [settings, paid, prior] = await Promise.all([fetchBookingSettings(db), paymentSummary(db, bookingId), priorReschedules(db, bookingId)]);
  const base = { status: b.status, startsAt: b.startsAt, now, noticeHours: settings.customerChangeNoticeHours, netPaidKobo: paid.netPaidKobo, priorReschedules: prior };
  const cancel = evaluateCustomerChange(base, "cancel");
  const reschedule = evaluateCustomerChange(base, "reschedule");
  return {
    canCancel: cancel.ok, canReschedule: reschedule.ok,
    cancelBlockedReason: cancel.ok ? null : REASON_TEXT[cancel.reason],
    rescheduleBlockedReason: reschedule.ok ? null : REASON_TEXT[reschedule.reason],
    noticeHours: settings.customerChangeNoticeHours,
  };
}

export async function customerCancel(db: Db, reference: string, token: string | undefined, reason: string | undefined, now = new Date()) {
  const owned = await loadOwned(db, reference, token);
  return db.transaction(async (tx) => {
    // Re-read inside the transaction so the decision uses the latest status and payments.
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, owned.id)).for("update").limit(1);
    const settings = await fetchBookingSettings(tx as unknown as Db);
    const paid = await paymentSummary(tx as unknown as Db, b.id);
    const verdict = evaluateCustomerChange({ status: b.status, startsAt: b.startsAt, now, noticeHours: settings.customerChangeNoticeHours, netPaidKobo: paid.netPaidKobo, priorReschedules: 0 }, "cancel");
    if (!verdict.ok) throw new AppError("conflict", REASON_TEXT[verdict.reason]);
    const text = (reason ?? "").trim().slice(0, 300);
    await transitionInTx(tx, null, b.id, "cancelled", { reason: text ? `Cancelled by customer: ${text}` : "Cancelled by customer" });
    return { status: "cancelled" as const };
  });
}

export async function customerReschedule(db: Db, reference: string, token: string | undefined, date: string, slotId: string, now = new Date()) {
  if (!isValidDateString(date)) throw new AppError("validation", "Choose a valid date", { date: ["Invalid"] });
  const owned = await loadOwned(db, reference, token);
  const [svc] = await db.select({ minNoticeHours: services.minNoticeHours }).from(services).where(eq(services.id, owned.serviceId)).limit(1);
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, owned.id)).for("update").limit(1);
    const settings = await fetchBookingSettings(tx as unknown as Db);
    const paid = await paymentSummary(tx as unknown as Db, b.id);
    const prior = await priorReschedules(tx as unknown as Db, b.id);
    const verdict = evaluateCustomerChange({ status: b.status, startsAt: b.startsAt, now, noticeHours: settings.customerChangeNoticeHours, netPaidKobo: paid.netPaidKobo, priorReschedules: prior }, "reschedule");
    if (!verdict.ok) throw new AppError("conflict", REASON_TEXT[verdict.reason]);
    // The new slot must satisfy the same minimum notice as a brand-new booking for this service.
    await rescheduleInTx(tx, null, b.id, date, slotId, { minNoticeHours: svc.minNoticeHours, noteLabel: "Customer rescheduled" }, now);
    return { date, slotId };
  });
}
