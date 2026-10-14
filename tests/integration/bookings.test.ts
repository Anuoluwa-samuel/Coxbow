import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { createBooking, getBookingForCustomer } from "@/server/bookings";
import { getSlotAvailability } from "@/server/availability";
import { AppError } from "@/server/errors";
import { GOOD_DATE, NOW, bookingPayload, resetDb } from "./helpers";

beforeEach(async () => { await resetDb({ slotCapacity: 2 }); });

const rejects = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (err) => err);
  expect(e).toBeInstanceOf(AppError);
  expect((e as AppError).code).toBe(code);
  return e as AppError;
};

describe("createBooking", () => {
  it("saves a valid booking with a server-computed price and a reference", async () => {
    const r = await createBooking(db, bookingPayload({ sizeSqm: 80 }), NOW);
    expect(r.reference).toMatch(/^CXB-[A-Z2-9]{8}$/);
    expect(r.status).toBe("requested");
    expect(r.estimateKobo).toBe(4_000_000); // demo 61-120 sqm tier
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.reference, r.reference));
    expect(row.status).toBe("requested");
    expect(row.startsAt.toISOString()).toBe("2030-01-15T07:00:00.000Z"); // 8am Lagos = 07:00Z
    expect(row.scopeSnapshot).toMatchObject({ service: { name: "Residential Cleaning" } });
  });

  it("ignores any client-supplied price, status or total", async () => {
    const r = await createBooking(db, bookingPayload({ estimateKobo: 1, totalKobo: 1, status: "confirmed", finalKobo: 1 }), NOW);
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.reference, r.reference));
    expect(row.estimateKobo).toBe(4_000_000);
    expect(row.status).toBe("requested");
    expect(row.finalKobo).toBeNull();
  });

  it("creates a quotation request (no price) for inspection services", async () => {
    const r = await createBooking(db, bookingPayload({ serviceSlug: "post-construction-cleaning", materials: undefined }), NOW);
    expect(r.requiresQuotation).toBe(true);
    expect(r.estimateKobo).toBeNull();
  });

  it("rejects invalid input with field errors", async () => {
    const e = await rejects(createBooking(db, bookingPayload({ customerPhone: "123", consent: false }), NOW), "validation");
    expect(Object.keys(e.fieldErrors ?? {})).toEqual(expect.arrayContaining(["customerPhone", "consent"]));
  });

  it("rejects disabled or unknown services and unsupported property types", async () => {
    await db.update(schema.services).set({ enabled: false }).where(eq(schema.services.slug, "deep-cleaning"));
    await rejects(createBooking(db, bookingPayload({ serviceSlug: "deep-cleaning" }), NOW), "not_found");
    await rejects(createBooking(db, bookingPayload({ serviceSlug: "nope" }), NOW), "not_found");
    await rejects(createBooking(db, bookingPayload({ propertyType: "office" }), NOW), "validation");
  });

  it("rejects locations outside the service area", async () => {
    await rejects(createBooking(db, bookingPayload({ state: "Rivers", city: "Port Harcourt" }), NOW), "not_serviceable");
    await rejects(createBooking(db, bookingPayload({ state: "Abuja (FCT)", city: "Wuse" }), NOW), "not_serviceable"); // disabled area
    await rejects(createBooking(db, bookingPayload({ city: "Lekki", neighbourhood: "Nowhere" }), NOW), "not_serviceable");
  });

  it("rejects unknown add-ons", async () => {
    await rejects(createBooking(db, bookingPayload({ addonSlugs: ["does-not-exist"] }), NOW), "validation");
  });

  it("enforces notice period, closed days and the booking window", async () => {
    await rejects(createBooking(db, bookingPayload({ date: "2030-01-01" }), NOW), "slot_unavailable");
    await rejects(createBooking(db, bookingPayload({ date: "2030-01-13" }), NOW), "slot_unavailable"); // Sunday
    await rejects(createBooking(db, bookingPayload({ date: "2031-06-03" }), NOW), "slot_unavailable"); // beyond 60 days
  });

  it("does not create a booking when a request fails", async () => {
    await rejects(createBooking(db, bookingPayload({ customerPhone: "bad" }), NOW), "validation");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings);
    expect(n).toBe(0);
  });
});

describe("slot capacity and double booking", () => {
  it("rejects a booking once the slot is full, and reports it as unavailable", async () => {
    await createBooking(db, bookingPayload(), NOW);
    await createBooking(db, bookingPayload(), NOW);
    await rejects(createBooking(db, bookingPayload(), NOW), "slot_unavailable");
    const slots = await getSlotAvailability(db, "residential-cleaning", GOOD_DATE, NOW);
    expect(slots.find((s) => s.id === "morning")).toMatchObject({ available: false, reason: "Fully booked" });
    expect(slots.find((s) => s.id === "midday")?.available).toBe(true);
  });

  it("never oversells under concurrent requests", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => createBooking(db, bookingPayload(), NOW)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings);
    expect(n).toBe(2);
  });

  it("frees capacity when a booking is cancelled", async () => {
    const a = await createBooking(db, bookingPayload(), NOW);
    await createBooking(db, bookingPayload(), NOW);
    await db.update(schema.bookings).set({ status: "cancelled" }).where(eq(schema.bookings.reference, a.reference));
    await expect(createBooking(db, bookingPayload(), NOW)).resolves.toBeTruthy();
  });
});

describe("duplicate submissions", () => {
  it("returns the same booking for a repeated idempotency key", async () => {
    const payload = bookingPayload();
    const first = await createBooking(db, payload, NOW);
    const second = await createBooking(db, payload, NOW);
    expect(second.reference).toBe(first.reference);
    expect(second.accessToken).toBe(first.accessToken);
    expect(second.replayed).toBe(true);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings);
    expect(n).toBe(1);
  });

  it("creates exactly one booking when the same request races itself", async () => {
    const payload = bookingPayload();
    const results = await Promise.all(Array.from({ length: 6 }, () => createBooking(db, payload, NOW)));
    expect(new Set(results.map((r) => r.reference)).size).toBe(1);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings);
    expect(n).toBe(1);
  });

  it("reuses the customer record for the same phone number", async () => {
    await createBooking(db, bookingPayload({ customerPhone: "08031112222" }), NOW);
    await createBooking(db, bookingPayload({ customerPhone: "+2348031112222", customerName: "Ada O." }), NOW);
    const rows = await db.select().from(schema.customers);
    expect(rows).toHaveLength(1);
    expect(rows[0].fullName).toBe("Ada O.");
  });
});

describe("customer privacy", () => {
  it("shows a booking only with the correct reference AND token", async () => {
    const a = await createBooking(db, bookingPayload({ customerName: "Alice A" }), NOW);
    const b = await createBooking(db, bookingPayload({ customerName: "Bob B" }), NOW);
    expect((await getBookingForCustomer(db, a.reference, a.accessToken))?.customerName).toBe("Alice A");
    expect(await getBookingForCustomer(db, a.reference, b.accessToken)).toBeNull(); // another customer's token
    expect(await getBookingForCustomer(db, a.reference, "wrong-token")).toBeNull();
    expect(await getBookingForCustomer(db, a.reference, undefined)).toBeNull();
    expect(await getBookingForCustomer(db, "CXB-NOTREAL1", a.accessToken)).toBeNull();
  });

  it("never exposes internal notes or other customers' data", async () => {
    const a = await createBooking(db, bookingPayload(), NOW);
    const view = await getBookingForCustomer(db, a.reference, a.accessToken);
    expect(JSON.stringify(view)).not.toMatch(/internal|passwordHash|phone/i);
  });
});
