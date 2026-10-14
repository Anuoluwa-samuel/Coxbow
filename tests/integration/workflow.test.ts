import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { createBooking, getBookingForCustomer } from "@/server/bookings";
import { assignStaff, rescheduleBooking, respondToQuotation, sendQuotation, transitionBooking } from "@/server/workflow";
import { AppError } from "@/server/errors";
import { NOW, bookingPayload, makeStaff, makeUser, resetDb } from "./helpers";

beforeEach(async () => { await resetDb({ slotCapacity: 3 }); });

const code = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e) as AppError | null)?.code;
const idOf = async (reference: string) => (await db.select().from(schema.bookings).where(eq(schema.bookings.reference, reference)))[0].id;
const statusOf = async (id: string) => (await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)))[0].status;

describe("approval and status transitions", () => {
  it("a new request is never confirmed automatically", async () => {
    const r = await createBooking(db, bookingPayload(), NOW);
    expect(await statusOf(await idOf(r.reference))).toBe("requested");
  });

  it("only staff with booking permission can confirm; cleaners cannot", async () => {
    const id = await idOf((await createBooking(db, bookingPayload(), NOW)).reference);
    const cleaner = await makeUser("cleaner");
    const manager = await makeUser("manager");
    expect(await code(transitionBooking(db, cleaner, id, "confirmed"))).toBe("forbidden");
    expect(await statusOf(id)).toBe("requested");
    await transitionBooking(db, manager, id, "confirmed");
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(row.status).toBe("confirmed");
    expect(row.finalKobo).toBe(row.estimateKobo); // price frozen at approval
  });

  it("rejects invalid transitions and records history for valid ones", async () => {
    const id = await idOf((await createBooking(db, bookingPayload(), NOW)).reference);
    const admin = await makeUser("admin");
    expect(await code(transitionBooking(db, admin, id, "completed"))).toBe("invalid_transition");
    expect(await code(transitionBooking(db, admin, id, "in_progress"))).toBe("invalid_transition");
    await transitionBooking(db, admin, id, "confirmed");
    expect(await code(transitionBooking(db, admin, id, "requested"))).toBe("invalid_transition");
    const history = await db.select().from(schema.bookingStatusHistory).where(eq(schema.bookingStatusHistory.bookingId, id));
    expect(history.map((h) => h.toStatus)).toEqual(["requested", "confirmed"]);
  });

  it("requires a reason to cancel, then frees assignments and blocks further changes", async () => {
    const id = await idOf((await createBooking(db, bookingPayload(), NOW)).reference);
    const admin = await makeUser("admin");
    expect(await code(transitionBooking(db, admin, id, "cancelled"))).toBe("validation");
    await transitionBooking(db, admin, id, "cancelled", { reason: "Customer request" });
    expect(await code(transitionBooking(db, admin, id, "confirmed"))).toBe("invalid_transition");
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(row.cancelReason).toBe("Customer request");
  });

  it("cannot be moved to 'quoted' except by sending a quotation", async () => {
    const id = await idOf((await createBooking(db, bookingPayload(), NOW)).reference);
    expect(await code(transitionBooking(db, await makeUser("admin"), id, "quoted"))).toBe("validation");
  });

  it("writes audit entries for sensitive actions", async () => {
    const id = await idOf((await createBooking(db, bookingPayload(), NOW)).reference);
    const admin = await makeUser("admin");
    await transitionBooking(db, admin, id, "confirmed");
    const logs = await db.select().from(schema.auditLogs);
    expect(logs.some((l) => l.action === "booking.confirmed" && l.actorId === admin.id && l.entityId === id)).toBe(true);
  });
});

describe("quotation flow", () => {
  async function quoteRequest() {
    const r = await createBooking(db, bookingPayload({ serviceSlug: "post-construction-cleaning", materials: undefined }), NOW);
    return { ...r, id: await idOf(r.reference) };
  }

  it("cannot confirm a quotation-required booking until the customer accepts", async () => {
    const b = await quoteRequest();
    const manager = await makeUser("manager");
    expect(await code(transitionBooking(db, manager, b.id, "confirmed"))).toBe("invalid_transition"); // straight from requested
    await sendQuotation(db, manager, b.id, { amountKobo: 15_000_000 });
    expect(await statusOf(b.id)).toBe("quoted");
    expect(await code(transitionBooking(db, manager, b.id, "confirmed"))).toBe("invalid_transition"); // not yet accepted
    await respondToQuotation(db, b.reference, b.accessToken, true, NOW);
    await transitionBooking(db, manager, b.id, "confirmed");
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, b.id));
    expect(row).toMatchObject({ status: "confirmed", finalKobo: 15_000_000 });
  });

  it("revising a quotation supersedes the old one and clears prior acceptance", async () => {
    const b = await quoteRequest();
    const manager = await makeUser("manager");
    await sendQuotation(db, manager, b.id, { amountKobo: 10_000_000 });
    await respondToQuotation(db, b.reference, b.accessToken, true, NOW);
    await sendQuotation(db, manager, b.id, { amountKobo: 12_000_000, notes: "Revised after inspection" });
    const qs = await db.select().from(schema.quotations).where(eq(schema.quotations.bookingId, b.id));
    expect(qs.map((q) => [q.version, q.status]).sort()).toEqual([[1, "superseded"], [2, "sent"]]);
    expect(await code(transitionBooking(db, manager, b.id, "confirmed"))).toBe("invalid_transition");
  });

  it("only the holder of the booking token can respond; expired quotations are refused", async () => {
    const b = await quoteRequest();
    const other = await createBooking(db, bookingPayload({ serviceSlug: "post-construction-cleaning", materials: undefined }), NOW);
    const manager = await makeUser("manager");
    await sendQuotation(db, manager, b.id, { amountKobo: 10_000_000, validUntil: new Date("2030-01-05T00:00:00Z") });
    expect(await code(respondToQuotation(db, b.reference, other.accessToken, true, NOW))).toBe("not_found");
    expect(await code(respondToQuotation(db, b.reference, undefined, true, NOW))).toBe("not_found");
    expect(await code(respondToQuotation(db, b.reference, b.accessToken, true, new Date("2030-02-01T00:00:00Z")))).toBe("conflict");
  });

  it("only quotation managers can send quotations and amounts must be positive", async () => {
    const b = await quoteRequest();
    expect(await code(sendQuotation(db, await makeUser("cleaner"), b.id, { amountKobo: 100 }))).toBe("forbidden");
    expect(await code(sendQuotation(db, await makeUser("manager"), b.id, { amountKobo: -5 }))).toBe("validation");
  });

  it("shows the live quotation to the customer via their private link", async () => {
    const b = await quoteRequest();
    await sendQuotation(db, await makeUser("manager"), b.id, { amountKobo: 9_900_000 });
    const view = await getBookingForCustomer(db, b.reference, b.accessToken);
    expect(view?.quotation).toMatchObject({ amountKobo: 9_900_000, status: "sent" });
  });
});

describe("staff assignment and conflicts", () => {
  async function confirmed(over: Record<string, unknown> = {}) {
    const r = await createBooking(db, bookingPayload(over), NOW);
    const id = await idOf(r.reference);
    await transitionBooking(db, await makeUser("manager"), id, "confirmed");
    return id;
  }

  it("cannot schedule without a cleaner, and assigning moves the booking to scheduled", async () => {
    const id = await confirmed();
    const manager = await makeUser("manager");
    expect(await code(transitionBooking(db, manager, id, "scheduled"))).toBe("invalid_transition");
    const { staffId } = await makeStaff();
    await assignStaff(db, manager, id, staffId);
    expect(await statusOf(id)).toBe("scheduled");
  });

  it("refuses to double-book the same cleaner at overlapping times, even concurrently", async () => {
    const [a, b, c] = [await confirmed(), await confirmed(), await confirmed()];
    const manager = await makeUser("manager");
    const { staffId } = await makeStaff();
    const results = await Promise.allSettled([a, b, c].map((id) => assignStaff(db, manager, id, staffId)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => (r.reason as AppError).code === "conflict")).toBe(true);
  });

  it("allows one cleaner on different slots and requires a confirmed booking", async () => {
    const m = await confirmed({ timeSlotId: "morning" });
    const af = await confirmed({ timeSlotId: "afternoon" });
    const manager = await makeUser("manager");
    const { staffId } = await makeStaff();
    await assignStaff(db, manager, m, staffId);
    await assignStaff(db, manager, af, staffId);
    const unconfirmed = await idOf((await createBooking(db, bookingPayload(), NOW)).reference);
    expect(await code(assignStaff(db, manager, unconfirmed, staffId))).toBe("invalid_transition");
  });

  it("lets a cleaner progress only their own assigned job", async () => {
    const id = await confirmed();
    const manager = await makeUser("manager");
    const mine = await makeStaff();
    const theirs = await makeStaff();
    await assignStaff(db, manager, id, mine.staffId);
    expect(await code(transitionBooking(db, theirs.user, id, "in_progress"))).toBe("forbidden");
    await transitionBooking(db, mine.user, id, "in_progress");
    await transitionBooking(db, mine.user, id, "completed");
    expect(await statusOf(id)).toBe("completed");
  });

  it("rescheduling moves assignments, respects capacity, and keeps history", async () => {
    const id = await confirmed();
    const manager = await makeUser("manager");
    const { staffId } = await makeStaff();
    await assignStaff(db, manager, id, staffId);
    await rescheduleBooking(db, manager, id, "2030-01-16", "midday", NOW);
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(row).toMatchObject({ scheduledDate: "2030-01-16", timeSlotId: "midday" });
    const [asg] = await db.select().from(schema.bookingAssignments).where(eq(schema.bookingAssignments.bookingId, id));
    expect(asg.startsAt.toISOString()).toBe("2030-01-16T10:00:00.000Z");
    expect(await code(rescheduleBooking(db, manager, id, "2030-01-13", "morning", NOW))).toBe("slot_unavailable"); // Sunday
    expect((await db.select().from(schema.bookingStatusHistory).where(eq(schema.bookingStatusHistory.bookingId, id))).some((h) => h.note?.startsWith("Rescheduled"))).toBe(true);
  });
});
