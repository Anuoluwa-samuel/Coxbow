import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import {
  auditLogs, bookingAssignments, bookingItems, bookingNotes, bookingStatusHistory, bookings, customers, payments, quotations, refunds,
  services, staffProfiles, timeSlots, users,
} from "./db/schema";
import { lagosDateString } from "@/lib/availability";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/booking-status";

export async function dashboardStats(db: Db, now = new Date()) {
  const today = lagosDateString(now);
  const counts = await db.select({ status: bookings.status, n: sql<number>`count(*)::int` }).from(bookings).groupBy(bookings.status);
  const by = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<BookingStatus, number>>;
  const [todayJobs] = await db.select({ n: sql<number>`count(*)::int` }).from(bookings)
    .where(and(eq(bookings.scheduledDate, today), inArray(bookings.status, ["confirmed", "scheduled", "in_progress"])));

  const [paid] = await db.select({ n: sql<number>`coalesce(sum(${payments.amountKobo}),0)::bigint` }).from(payments)
    .where(and(inArray(payments.status, ["success", "partially_refunded", "refunded"]), sql`${payments.verifiedAt} IS NOT NULL`));
  const [refunded] = await db.select({ n: sql<number>`coalesce(sum(${refunds.amountKobo}),0)::bigint` }).from(refunds);
  const [billed] = await db.select({ n: sql<number>`coalesce(sum(${bookings.finalKobo}),0)::bigint` }).from(bookings)
    .where(and(inArray(bookings.status, ["confirmed", "scheduled", "in_progress", "completed"]), sql`${bookings.finalKobo} IS NOT NULL`));
  const [paidOnLive] = await db.select({ n: sql<number>`coalesce(sum(${payments.amountKobo}),0)::bigint` }).from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(and(inArray(bookings.status, ["confirmed", "scheduled", "in_progress", "completed"]), inArray(payments.status, ["success", "partially_refunded", "refunded"])));
  const [refundedOnLive] = await db.select({ n: sql<number>`coalesce(sum(${refunds.amountKobo}),0)::bigint` }).from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId)).innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(inArray(bookings.status, ["confirmed", "scheduled", "in_progress", "completed"]));

  return {
    newRequests: by.requested ?? 0,
    pendingQuotations: by.quoted ?? 0,
    confirmed: (by.confirmed ?? 0) + (by.scheduled ?? 0),
    todayJobs: todayJobs.n,
    completed: by.completed ?? 0,
    cancelled: (by.cancelled ?? 0) + (by.rejected ?? 0),
    revenueKobo: Number(paid.n) - Number(refunded.n),
    outstandingKobo: Math.max(0, Number(billed.n) - (Number(paidOnLive.n) - Number(refundedOnLive.n))),
  };
}

export interface BookingFilters { q?: string; status?: string; service?: string; city?: string; from?: string; to?: string; page?: number }
export const PAGE_SIZE = 20;

export async function listBookings(db: Db, f: BookingFilters, scope?: { staffUserId: string }) {
  const conds = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(bookings.reference, like), ilike(customers.fullName, like), ilike(customers.phone, like), ilike(bookings.address, like)));
  }
  if (f.status && (BOOKING_STATUSES as readonly string[]).includes(f.status)) conds.push(eq(bookings.status, f.status as BookingStatus));
  if (f.service) conds.push(eq(services.slug, f.service));
  if (f.city) conds.push(ilike(bookings.city, f.city));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) conds.push(gte(bookings.scheduledDate, f.from));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) conds.push(lte(bookings.scheduledDate, f.to));
  if (scope) {
    conds.push(sql`${bookings.id} IN (SELECT ${bookingAssignments.bookingId} FROM ${bookingAssignments} INNER JOIN ${staffProfiles} ON ${staffProfiles.id} = ${bookingAssignments.staffId} WHERE ${staffProfiles.userId} = ${scope.staffUserId} AND ${bookingAssignments.status} = 'active')`);
  }
  const where = conds.length ? and(...conds) : undefined;
  const base = db.select({
    id: bookings.id, reference: bookings.reference, status: bookings.status, scheduledDate: bookings.scheduledDate, slot: timeSlots.label,
    service: services.name, customer: customers.fullName, phone: customers.phone, city: bookings.city, address: bookings.address,
    estimateKobo: bookings.estimateKobo, finalKobo: bookings.finalKobo, requiresQuotation: bookings.requiresQuotation, createdAt: bookings.createdAt,
  }).from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId)).innerJoin(services, eq(services.id, bookings.serviceId)).innerJoin(timeSlots, eq(timeSlots.id, bookings.timeSlotId));
  const page = Math.max(1, f.page ?? 1);
  const rows = await base.where(where).orderBy(desc(bookings.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId)).innerJoin(services, eq(services.id, bookings.serviceId)).where(where);
  return { rows, total: n, page, pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}

export async function getBookingDetail(db: Db, id: string) {
  const [row] = await db.select({ b: bookings, service: services.name, slot: timeSlots.label, customer: customers })
    .from(bookings).innerJoin(services, eq(services.id, bookings.serviceId)).innerJoin(timeSlots, eq(timeSlots.id, bookings.timeSlotId))
    .innerJoin(customers, eq(customers.id, bookings.customerId)).where(eq(bookings.id, id)).limit(1);
  if (!row) return null;
  const [items, history, notes, quotes, assigned, pays] = await Promise.all([
    db.select().from(bookingItems).where(eq(bookingItems.bookingId, id)),
    db.select({ h: bookingStatusHistory, actor: users.fullName }).from(bookingStatusHistory).leftJoin(users, eq(users.id, bookingStatusHistory.actorId)).where(eq(bookingStatusHistory.bookingId, id)).orderBy(asc(bookingStatusHistory.createdAt)),
    db.select({ n: bookingNotes, author: users.fullName }).from(bookingNotes).innerJoin(users, eq(users.id, bookingNotes.authorId)).where(eq(bookingNotes.bookingId, id)).orderBy(desc(bookingNotes.createdAt)),
    db.select().from(quotations).where(eq(quotations.bookingId, id)).orderBy(desc(quotations.version)),
    db.select({ a: bookingAssignments, name: users.fullName }).from(bookingAssignments).innerJoin(staffProfiles, eq(staffProfiles.id, bookingAssignments.staffId)).innerJoin(users, eq(users.id, staffProfiles.userId)).where(eq(bookingAssignments.bookingId, id)),
    db.select().from(payments).where(eq(payments.bookingId, id)).orderBy(desc(payments.createdAt)),
  ]);
  return { ...row, items, history, notes, quotes, assigned, payments: pays };
}

export async function listCustomers(db: Db, q?: string) {
  const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
  return db.select({
    id: customers.id, name: customers.fullName, phone: customers.phone, email: customers.email, createdAt: customers.createdAt,
    bookings: sql<number>`(select count(*)::int from bookings b where b.customer_id = ${customers.id})`,
  }).from(customers)
    .where(like ? or(ilike(customers.fullName, like), ilike(customers.phone, like), ilike(customers.email, like)) : undefined)
    .orderBy(desc(customers.createdAt)).limit(100);
}

export async function getCustomer(db: Db, id: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return null;
  const history = await db.select({ id: bookings.id, reference: bookings.reference, status: bookings.status, date: bookings.scheduledDate, service: services.name, finalKobo: bookings.finalKobo, estimateKobo: bookings.estimateKobo })
    .from(bookings).innerJoin(services, eq(services.id, bookings.serviceId)).where(eq(bookings.customerId, id)).orderBy(desc(bookings.createdAt));
  return { customer: c, history };
}

export async function listPayments(db: Db) {
  return db.select({ p: payments, reference: bookings.reference, customer: customers.fullName })
    .from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId)).innerJoin(customers, eq(customers.id, bookings.customerId))
    .orderBy(desc(payments.createdAt)).limit(200);
}

export async function listAudit(db: Db, limit = 200) {
  return db.select({ a: auditLogs, actor: users.fullName }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function listStaff(db: Db) {
  return db.select({ staffId: staffProfiles.id, userId: users.id, name: users.fullName, email: users.email, role: users.role, phone: staffProfiles.phone, active: staffProfiles.active })
    .from(staffProfiles).innerJoin(users, eq(users.id, staffProfiles.userId)).orderBy(asc(users.fullName));
}

export async function upcomingAssignments(db: Db, staffId: string, now = new Date()) {
  return db.select({ id: bookings.id, reference: bookings.reference, status: bookings.status, startsAt: bookingAssignments.startsAt, service: services.name, address: bookings.address, city: bookings.city })
    .from(bookingAssignments).innerJoin(bookings, eq(bookings.id, bookingAssignments.bookingId)).innerJoin(services, eq(services.id, bookings.serviceId))
    .where(and(eq(bookingAssignments.staffId, staffId), eq(bookingAssignments.status, "active"), gte(bookingAssignments.endsAt, now)))
    .orderBy(asc(bookingAssignments.startsAt)).limit(20);
}
