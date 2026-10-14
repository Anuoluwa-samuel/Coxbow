import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { createBooking } from "@/server/bookings";
import { createStaffUser, setUserActive } from "@/server/staff";
import { createService, updateService, updateTimeSlot, upsertArea, upsertAddon, updateBookingSettings, buildPricingConfig } from "@/server/catalog-admin";
import { dashboardStats, listBookings } from "@/server/admin-queries";
import { assignStaff, transitionBooking } from "@/server/workflow";
import { login } from "@/server/auth-core";
import { fetchService } from "@/server/catalog-db";
import type { AppError } from "@/server/errors";
import { NOW, bookingPayload, makeStaff, makeUser, resetDb } from "./helpers";

beforeEach(async () => { await resetDb({ slotCapacity: 5 }); });
const code = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e) as AppError | null)?.code;

const validService = {
  name: "Residential Cleaning", summary: "A summary here", description: "A long enough description.", idealFor: "A", includes: "One thing", excludes: "", extraCharges: "",
  pricingNote: "", pricingModel: "fixed", baseNaira: "30000", tiers: "", minNoticeHours: "24", durationMinutes: "120", enabled: true, popular: false,
};

describe("authorisation: unauthorised users cannot use admin functions", () => {
  it("service, area, slot and settings changes are admin-only", async () => {
    const manager = await makeUser("manager");
    const cleaner = await makeUser("cleaner");
    for (const actor of [manager, cleaner]) {
      expect(await code(updateService(db, actor, "residential-cleaning", validService))).toBe("forbidden");
      expect(await code(createService(db, actor, { name: "X Service", slug: "x-service", categorySlug: "residential" }))).toBe("forbidden");
      expect(await code(upsertAddon(db, actor, "residential-cleaning", { slug: "a-b", name: "Ab", priceKobo: 1, enabled: true }))).toBe("forbidden");
      expect(await code(upsertArea(db, actor, { state: "Lagos", city: "Ikorodu", neighbourhoods: [], enabled: true }))).toBe("forbidden");
      expect(await code(updateTimeSlot(db, actor, "morning", { capacity: 9, enabled: true }))).toBe("forbidden");
      expect(await code(updateBookingSettings(db, actor, { operatingDays: [1], maxAdvanceDays: 5 }))).toBe("forbidden");
    }
    expect((await fetchService(db, "residential-cleaning"))?.pricing.model).toBe("by_size"); // unchanged
  });

  it("cleaners cannot create staff; managers cannot create managers or admins", async () => {
    const base = { fullName: "New Person", email: "new@example.test", role: "cleaner", password: "a-sufficiently-long-pw" };
    expect(await code(createStaffUser(db, await makeUser("cleaner"), base))).toBe("forbidden");
    const manager = await makeUser("manager");
    expect(await code(createStaffUser(db, manager, { ...base, role: "manager" }))).toBe("forbidden");
    expect(await code(createStaffUser(db, manager, { ...base, role: "admin" }))).toBe("forbidden");
    await expect(createStaffUser(db, manager, base)).resolves.toBeTruthy();
    expect(await code(createStaffUser(db, manager, base))).toBe("conflict"); // duplicate email
    expect(await code(createStaffUser(db, await makeUser("admin"), { ...base, email: "x@example.test", password: "short" }))).toBe("validation");
  });

  it("managers cannot deactivate admins; nobody can deactivate themselves; deactivation ends sessions and sign-in", async () => {
    const manager = await makeUser("manager");
    const admin = await makeUser("admin");
    expect(await code(setUserActive(db, manager, admin.id, false))).toBe("forbidden");
    expect(await code(setUserActive(db, admin, admin.id, false))).toBe("validation");
    const { user } = await makeStaff();
    const session = await login(db, user.email, user.password);
    expect(session.ok).toBe(true);
    await setUserActive(db, manager, user.id, false);
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, user.id))).toHaveLength(0);
    expect((await login(db, user.email, user.password)).ok).toBe(false);
  });
});

describe("admin catalogue management", () => {
  it("admins can edit pricing, enable/disable and the change is audited", async () => {
    const admin = await makeUser("admin");
    await updateService(db, admin, "residential-cleaning", { ...validService, pricingModel: "fixed", baseNaira: "30000" });
    const s = await fetchService(db, "residential-cleaning");
    expect(s?.pricing).toMatchObject({ model: "fixed", baseKobo: 3_000_000 });
    await updateService(db, admin, "residential-cleaning", { ...validService, enabled: false });
    expect(await fetchService(db, "residential-cleaning")).toBeNull(); // hidden from customers
    expect((await db.select().from(schema.auditLogs)).filter((l) => l.action === "service.update")).toHaveLength(2);
  });
  it("validates pricing config and refuses to enable a service with no inclusions", async () => {
    const admin = await makeUser("admin");
    expect(await code(updateService(db, admin, "residential-cleaning", { ...validService, pricingModel: "by_size", tiers: "garbage" }))).toBe("validation");
    expect(await code(updateService(db, admin, "residential-cleaning", { ...validService, includes: "" }))).toBe("validation");
    expect(() => buildPricingConfig("fixed", "-5")).toThrow();
    expect(buildPricingConfig("by_size", undefined, "120: 50,000\n60: 30000")).toMatchObject({ sizeTiers: [{ maxSqm: 60, priceKobo: 3_000_000 }, { maxSqm: 120, priceKobo: 5_000_000 }] });
  });
  it("new services start disabled and cannot be booked until enabled", async () => {
    const admin = await makeUser("admin");
    const slug = await createService(db, admin, { name: "Window Cleaning", slug: "window-cleaning", categorySlug: "specialised" });
    expect(await fetchService(db, slug)).toBeNull();
    expect(await code(createService(db, admin, { name: "Dup", slug: "window-cleaning", categorySlug: "specialised" }))).toBe("conflict");
    expect(await code(createService(db, admin, { name: "Bad Slug", slug: "Bad Slug!", categorySlug: "specialised" }))).toBe("validation");
    expect(await code(createBooking(db, bookingPayload({ serviceSlug: slug }), NOW))).toBe("not_found");
  });
  it("area and settings changes take effect on the server immediately", async () => {
    const admin = await makeUser("admin");
    await upsertArea(db, admin, { state: "Lagos", city: "Ikorodu", neighbourhoods: [], enabled: true });
    await expect(createBooking(db, bookingPayload({ city: "Ikorodu" }), NOW)).resolves.toBeTruthy();
    await upsertArea(db, admin, { state: "Lagos", city: "Ikorodu", neighbourhoods: [], enabled: false });
    expect(await code(createBooking(db, bookingPayload({ city: "Ikorodu" }), NOW))).toBe("not_serviceable");
    await updateBookingSettings(db, admin, { operatingDays: [1, 2, 3, 4, 5, 6, 0], maxAdvanceDays: 60 });
    await expect(createBooking(db, bookingPayload({ date: "2030-01-13" }), NOW)).resolves.toBeTruthy(); // Sunday now open
    await updateTimeSlot(db, admin, "morning", { capacity: 1, enabled: true });
    expect(await code(createBooking(db, bookingPayload({ date: "2030-01-13" }), NOW))).toBe("slot_unavailable");
  });
});

describe("dashboard metrics come from the database", () => {
  it("counts bookings by status and computes revenue only from verified payments", async () => {
    expect(await dashboardStats(db, NOW)).toMatchObject({ newRequests: 0, confirmed: 0, revenueKobo: 0, outstandingKobo: 0 });
    const manager = await makeUser("manager");
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await createBooking(db, bookingPayload({ date: "2030-01-15" }), NOW);
      ids.push((await db.select().from(schema.bookings).where(eq(schema.bookings.reference, r.reference)))[0].id);
    }
    await transitionBooking(db, manager, ids[0], "confirmed");
    await transitionBooking(db, manager, ids[1], "cancelled", { reason: "test" });
    // An UNVERIFIED pending payment must not count as revenue.
    await db.insert(schema.payments).values({ bookingId: ids[0], reference: "P-PENDING", amountKobo: 999_999, status: "pending" });
    const s = await dashboardStats(db, NOW);
    expect(s).toMatchObject({ newRequests: 1, confirmed: 1, cancelled: 1, revenueKobo: 0, outstandingKobo: 4_000_000 });
    await db.insert(schema.payments).values({ bookingId: ids[0], reference: "P-OK", amountKobo: 1_500_000, status: "success", verifiedAt: NOW, paidAt: NOW });
    expect(await dashboardStats(db, NOW)).toMatchObject({ revenueKobo: 1_500_000, outstandingKobo: 2_500_000 });
    // "Today's jobs" uses the Lagos calendar day.
    expect((await dashboardStats(db, new Date("2030-01-14T23:30:00Z"))).todayJobs).toBe(1);
  });
});

describe("booking list filters and cleaner scoping", () => {
  it("filters by status, service, city and text, and scopes cleaners to their own jobs", async () => {
    const manager = await makeUser("manager");
    const a = await createBooking(db, bookingPayload({ customerName: "Zainab Bello" }), NOW);
    await createBooking(db, bookingPayload({ serviceSlug: "post-construction-cleaning", materials: undefined, city: "Ikeja", neighbourhood: "GRA" }), NOW);
    expect((await listBookings(db, { q: "Zainab" })).total).toBe(1);
    expect((await listBookings(db, { q: a.reference.toLowerCase() })).total).toBe(1);
    expect((await listBookings(db, { service: "post-construction-cleaning" })).total).toBe(1);
    expect((await listBookings(db, { city: "ikeja" })).total).toBe(1);
    expect((await listBookings(db, { status: "requested" })).total).toBe(2);
    expect((await listBookings(db, { status: "completed" })).total).toBe(0);
    expect((await listBookings(db, { q: "%" })).total).toBe(2); // wildcard characters are stripped, not interpreted

    const id = (await db.select().from(schema.bookings).where(eq(schema.bookings.reference, a.reference)))[0].id;
    await transitionBooking(db, manager, id, "confirmed");
    const mine = await makeStaff();
    const other = await makeStaff();
    await assignStaff(db, manager, id, mine.staffId);
    expect((await listBookings(db, {}, { staffUserId: mine.user.id })).total).toBe(1);
    expect((await listBookings(db, {}, { staffUserId: other.user.id })).total).toBe(0);
  });
});
