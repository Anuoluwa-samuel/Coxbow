import { and, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "./db/client";
import { bookingAssignments, bookingNotes, bookingStatusHistory, bookings, quotations, staffProfiles, notifications, customers } from "./db/schema";
import { fetchBookingSettings, fetchTimeSlots } from "./catalog-db";
import { countHeld, isValidDateString } from "./availability";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { safeEqual, sha256 } from "./crypto";
import { canTransition, type BookingStatus } from "@/lib/booking-status";
import { checkSlot, lagosInstant } from "@/lib/availability";
import { can, type Permission } from "@/lib/permissions";
import type { SessionUser } from "./auth-core";

type Actor = Pick<SessionUser, "id" | "role">;

function need(actor: Actor, permission: Permission) {
  if (!can(actor.role, permission)) throw new AppError("forbidden", "You do not have permission to do that");
}

const sqlState = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;

async function lockBooking(tx: Tx, bookingId: string) {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update").limit(1);
  if (!b) throw new AppError("not_found", "Booking not found");
  return b;
}

async function activeAssignment(tx: Tx, bookingId: string, userId: string) {
  const rows = await tx
    .select({ id: bookingAssignments.id })
    .from(bookingAssignments)
    .innerJoin(staffProfiles, eq(staffProfiles.id, bookingAssignments.staffId))
    .where(and(eq(bookingAssignments.bookingId, bookingId), eq(bookingAssignments.status, "active"), eq(staffProfiles.userId, userId)));
  return rows.length > 0;
}

/** Permission required to move a booking INTO a status. */
const PERMISSION_FOR: Record<BookingStatus, Permission> = {
  requested: "bookings.manage", quoted: "quotations.manage", confirmed: "bookings.manage", scheduled: "bookings.manage",
  in_progress: "bookings.update_progress", completed: "bookings.update_progress", rejected: "bookings.manage", cancelled: "bookings.manage",
};

/**
 * The single place a booking's status changes. Enforces, on the server:
 *  - the transition table,
 *  - the permission for the target status (cleaners may only progress jobs assigned to them),
 *  - approval rules: nothing is confirmed without staff approval; quotation jobs need an accepted quotation.
 */
export async function transitionBooking(db: Db, actor: Actor, bookingId: string, to: BookingStatus, opts: { note?: string; reason?: string } = {}) {
  need(actor, PERMISSION_FOR[to]);
  if (to === "quoted") throw new AppError("validation", "Use sendQuotation to quote a booking");
  return db.transaction((tx) => transitionInTx(tx, actor, bookingId, to, opts));
}

async function transitionInTx(tx: Tx, actor: Actor, bookingId: string, to: BookingStatus, opts: { note?: string; reason?: string }) {
  const b = await lockBooking(tx, bookingId);
  if (!canTransition(b.status, to)) throw new AppError("invalid_transition", `A ${b.status} booking cannot become ${to}`);

  if ((to === "in_progress" || to === "completed") && actor.role === "cleaner" && !(await activeAssignment(tx, bookingId, actor.id))) {
    throw new AppError("forbidden", "You are not assigned to this job");
  }
  if ((to === "cancelled" || to === "rejected") && !opts.reason) throw new AppError("validation", "A reason is required", { reason: ["Required"] });

  const patch: Partial<typeof bookings.$inferInsert> = { status: to, updatedAt: new Date() };
  if (to === "confirmed") {
    if (b.requiresQuotation) {
      const [accepted] = await tx.select({ amount: quotations.amountKobo }).from(quotations).where(and(eq(quotations.bookingId, bookingId), eq(quotations.status, "accepted"))).limit(1);
      if (!accepted) throw new AppError("invalid_transition", "The customer must accept a quotation before this booking can be confirmed");
      patch.finalKobo = accepted.amount;
    } else {
      patch.finalKobo = b.estimateKobo;
    }
  }
  if (to === "scheduled") {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(bookingAssignments).where(and(eq(bookingAssignments.bookingId, bookingId), eq(bookingAssignments.status, "active")));
    if (n === 0) throw new AppError("invalid_transition", "Assign at least one cleaner before scheduling");
  }
  if (to === "completed") patch.completedAt = new Date();
  if (to === "cancelled") { patch.cancelledAt = new Date(); patch.cancelReason = opts.reason; }
  if (to === "rejected") patch.cancelReason = opts.reason;

  await tx.update(bookings).set(patch).where(eq(bookings.id, bookingId));
  if (to === "cancelled" || to === "rejected") {
    await tx.update(bookingAssignments).set({ status: "released" }).where(and(eq(bookingAssignments.bookingId, bookingId), eq(bookingAssignments.status, "active")));
    await tx.update(quotations).set({ status: "superseded" }).where(and(eq(quotations.bookingId, bookingId), sql`${quotations.status} IN ('draft','sent')`));
  }
  await tx.insert(bookingStatusHistory).values({ bookingId, fromStatus: b.status, toStatus: to, actorId: actor.id, note: opts.note ?? opts.reason ?? null });
  await writeAudit(tx, actor.id, `booking.${to}`, "booking", bookingId, { from: b.status, reason: opts.reason });

  if (["confirmed", "scheduled", "completed", "cancelled", "rejected"].includes(to)) {
    const [c] = await tx.select({ email: customers.email }).from(customers).where(eq(customers.id, b.customerId)).limit(1);
    if (c?.email) await tx.insert(notifications).values({ bookingId, channel: "email", recipient: c.email, template: `booking_${to}` });
  }
  return { from: b.status, to };
}

/** Sends (or revises) a quotation. Any earlier live quotation is superseded, never overwritten. */
export async function sendQuotation(db: Db, actor: Actor, bookingId: string, input: { amountKobo: number; notes?: string; validUntil?: Date }) {
  need(actor, "quotations.manage");
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) throw new AppError("validation", "Enter a valid amount", { amountKobo: ["Must be a positive amount"] });
  return db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.status !== "requested" && b.status !== "quoted") throw new AppError("invalid_transition", "A quotation can only be sent while the booking is requested or quoted");
    const prev = await tx.select().from(quotations).where(eq(quotations.bookingId, bookingId));
    await tx.update(quotations).set({ status: "superseded" }).where(and(eq(quotations.bookingId, bookingId), sql`${quotations.status} IN ('draft','sent','accepted')`));
    const version = prev.reduce((m, q) => Math.max(m, q.version), 0) + 1;
    const [q] = await tx.insert(quotations).values({ bookingId, version, amountKobo: input.amountKobo, notes: input.notes, validUntil: input.validUntil, status: "sent", createdBy: actor.id }).returning();
    if (b.status === "requested") await transitionInTx(tx, actor, bookingId, "quoted", { note: `Quotation v${version} sent` });
    else {
      await tx.insert(bookingStatusHistory).values({ bookingId, fromStatus: "quoted", toStatus: "quoted", actorId: actor.id, note: `Quotation revised to v${version}` });
      await tx.update(bookings).set({ finalKobo: null, updatedAt: new Date() }).where(eq(bookings.id, bookingId));
    }
    await writeAudit(tx, actor.id, "quotation.sent", "quotation", q.id, { bookingId, version, amountKobo: input.amountKobo });
    return q;
  });
}

/** Customer accepts or declines the current quotation via their private link. */
export async function respondToQuotation(db: Db, reference: string, token: string | undefined, accept: boolean, now = new Date()) {
  if (!token) throw new AppError("not_found", "Booking not found");
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.reference, reference)).for("update").limit(1);
    if (!b || !safeEqual(sha256(token), b.accessTokenHash)) throw new AppError("not_found", "Booking not found");
    const [q] = await tx.select().from(quotations).where(and(eq(quotations.bookingId, b.id), eq(quotations.status, "sent"))).limit(1);
    if (!q) throw new AppError("conflict", "There is no quotation awaiting your response");
    if (q.validUntil && q.validUntil < now) {
      await tx.update(quotations).set({ status: "expired" }).where(eq(quotations.id, q.id));
      throw new AppError("conflict", "This quotation has expired. Please contact us for a new one.");
    }
    await tx.update(quotations).set({ status: accept ? "accepted" : "declined", respondedAt: now }).where(eq(quotations.id, q.id));
    await writeAudit(tx, null, accept ? "quotation.accepted" : "quotation.declined", "quotation", q.id, { bookingId: b.id });
    return { status: accept ? ("accepted" as const) : ("declined" as const), amountKobo: q.amountKobo };
  });
}

/** Assigns a cleaner. The DB exclusion constraint rejects overlapping jobs even under concurrency. */
export async function assignStaff(db: Db, actor: Actor, bookingId: string, staffId: string) {
  need(actor, "bookings.manage");
  return db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.status !== "confirmed" && b.status !== "scheduled") throw new AppError("invalid_transition", "Confirm the booking before assigning staff");
    const [staff] = await tx.select().from(staffProfiles).where(eq(staffProfiles.id, staffId)).limit(1);
    if (!staff || !staff.active) throw new AppError("not_found", "Staff member not found or inactive");
    try {
      await tx.execute(sql`savepoint assign_try`);
      await tx.insert(bookingAssignments).values({ bookingId, staffId, startsAt: b.startsAt, endsAt: b.endsAt, assignedBy: actor.id });
      await tx.execute(sql`release savepoint assign_try`);
    } catch (e) {
      await tx.execute(sql`rollback to savepoint assign_try`);
      const code = sqlState(e);
      if (code === "23P01") throw new AppError("conflict", "That cleaner already has a job at this time");
      if (code === "23505") throw new AppError("conflict", "That cleaner is already assigned");
      throw e;
    }
    await writeAudit(tx, actor.id, "booking.assign", "booking", bookingId, { staffId });
    if (b.status === "confirmed") await transitionInTx(tx, actor, bookingId, "scheduled", { note: "Cleaner assigned" });
  });
}

export async function unassignStaff(db: Db, actor: Actor, bookingId: string, staffId: string) {
  need(actor, "bookings.manage");
  await db.transaction(async (tx) => {
    await lockBooking(tx, bookingId);
    await tx.update(bookingAssignments).set({ status: "released" }).where(and(eq(bookingAssignments.bookingId, bookingId), eq(bookingAssignments.staffId, staffId), eq(bookingAssignments.status, "active")));
    await writeAudit(tx, actor.id, "booking.unassign", "booking", bookingId, { staffId });
  });
}

/** Moves a booking to a new date/slot, re-checking capacity and moving any assignments with it. History is kept. */
export async function rescheduleBooking(db: Db, actor: Actor, bookingId: string, date: string, slotId: string, now = new Date()) {
  need(actor, "bookings.manage");
  if (!isValidDateString(date)) throw new AppError("validation", "Invalid date", { date: ["Choose a valid date"] });
  const [slots, settings] = await Promise.all([fetchTimeSlots(db), fetchBookingSettings(db)]);
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) throw new AppError("validation", "Unknown time slot", { timeSlotId: ["Choose a valid time slot"] });

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`slot:${date}:${slot.id}`}, 0))`);
    const b = await lockBooking(tx, bookingId);
    if (!["requested", "quoted", "confirmed", "scheduled"].includes(b.status)) throw new AppError("invalid_transition", `A ${b.status} booking cannot be rescheduled`);
    const sameSlot = b.scheduledDate === date && b.timeSlotId === slot.id;
    const held = await countHeld(tx, date, slot.id);
    const check = checkSlot({ date, slot, now, minNoticeHours: 0, operatingDays: settings.operatingDays, maxAdvanceDays: settings.maxAdvanceDays, bookedCount: sameSlot ? held - 1 : held, capacity: slot.capacity });
    if (!check.ok) throw new AppError("slot_unavailable", "That time slot is not available", { timeSlotId: [check.reason] });

    const startsAt = lagosInstant(date, slot.startHour);
    const endsAt = lagosInstant(date, slot.endHour);
    try {
      await tx.execute(sql`savepoint resched_try`);
      await tx.update(bookingAssignments).set({ startsAt, endsAt }).where(and(eq(bookingAssignments.bookingId, bookingId), eq(bookingAssignments.status, "active")));
      await tx.execute(sql`release savepoint resched_try`);
    } catch (e) {
      await tx.execute(sql`rollback to savepoint resched_try`);
      if (sqlState(e) === "23P01") throw new AppError("conflict", "An assigned cleaner is already booked at the new time");
      throw e;
    }
    await tx.update(bookings).set({ scheduledDate: date, timeSlotId: slot.id, startsAt, endsAt, updatedAt: now }).where(eq(bookings.id, bookingId));
    await tx.insert(bookingStatusHistory).values({ bookingId, fromStatus: b.status, toStatus: b.status, actorId: actor.id, note: `Rescheduled from ${b.scheduledDate} ${b.timeSlotId} to ${date} ${slot.id}` });
    await writeAudit(tx, actor.id, "booking.reschedule", "booking", bookingId, { from: { date: b.scheduledDate, slot: b.timeSlotId }, to: { date, slot: slot.id } });
  });
}

export async function addBookingNote(db: Db, actor: Actor, bookingId: string, body: string) {
  need(actor, "notes.write");
  const text = body.trim();
  if (!text || text.length > 2000) throw new AppError("validation", "Note must be 1 to 2000 characters", { body: ["Invalid length"] });
  await db.insert(bookingNotes).values({ bookingId, authorId: actor.id, body: text });
  await writeAudit(db, actor.id, "booking.note", "booking", bookingId);
}
