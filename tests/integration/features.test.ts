import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { createBooking, getBookingForCustomer } from "@/server/bookings";
import { assignStaff, transitionBooking } from "@/server/workflow";
import { customerCancel, customerReschedule } from "@/server/customer-changes";
import { recordManualPayment, initializePayment, paymentSummary } from "@/server/payments";
import { getPublicImage, removeServiceImage, setServiceImage } from "@/server/media";
import { deleteCategory, saveCategory, updateService } from "@/server/catalog-admin";
import { listApprovedReviews, listReviewsForModeration, setReviewApproved, submitReview } from "@/server/reviews";
import { fetchCategories, fetchService } from "@/server/catalog-db";
import type { AppError } from "@/server/errors";
import { NOW, bookingPayload, makeStaff, makeUser, resetDb } from "./helpers";

beforeEach(async () => { await resetDb({ slotCapacity: 5 }); });
const code = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e) as AppError | null)?.code;
const idOf = async (reference: string) => (await db.select().from(schema.bookings).where(eq(schema.bookings.reference, reference)))[0].id;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);

describe("service photos", () => {
  it("accepts a real image, serves it publicly, and replaces the old one without leaving orphans", async () => {
    const admin = await makeUser("admin");
    const first = await setServiceImage(db, admin, "deep-cleaning", PNG, "  A cleaner at work ");
    expect((await fetchService(db, "deep-cleaning"))).toMatchObject({ imageId: first, imageAlt: "A cleaner at work" });
    expect(await getPublicImage(db, first)).toMatchObject({ type: "image/png" });
    const second = await setServiceImage(db, admin, "deep-cleaning", JPG, "New photo");
    expect(second).not.toBe(first);
    expect(await getPublicImage(db, first)).toBeNull();
    expect(await db.select().from(schema.media)).toHaveLength(1);
  });
  it("rejects SVG/HTML renamed as images, oversize files, and empty uploads", async () => {
    const admin = await makeUser("admin");
    const enc = (t: string) => new TextEncoder().encode(t);
    expect(await code(setServiceImage(db, admin, "deep-cleaning", enc('<svg onload="alert(1)"></svg>'), ""))).toBe("validation");
    expect(await code(setServiceImage(db, admin, "deep-cleaning", enc("<script>alert(1)</script>"), ""))).toBe("validation");
    expect(await code(setServiceImage(db, admin, "deep-cleaning", new Uint8Array(0), ""))).toBe("validation");
    const big = new Uint8Array(1_500_001); big.set(PNG);
    expect(await code(setServiceImage(db, admin, "deep-cleaning", big, ""))).toBe("validation");
    expect(await code(setServiceImage(db, admin, "no-such-service", PNG, ""))).toBe("not_found");
    expect(await db.select().from(schema.media)).toHaveLength(0);
  });
  it("is admin-only and the image is hidden when the service is disabled", async () => {
    expect(await code(setServiceImage(db, await makeUser("manager"), "deep-cleaning", PNG, ""))).toBe("forbidden");
    expect(await code(removeServiceImage(db, await makeUser("cleaner"), "deep-cleaning"))).toBe("forbidden");
    const admin = await makeUser("admin");
    const id = await setServiceImage(db, admin, "deep-cleaning", PNG, "");
    await db.update(schema.services).set({ enabled: false }).where(eq(schema.services.slug, "deep-cleaning"));
    expect(await getPublicImage(db, id)).toBeNull();
    await db.update(schema.services).set({ enabled: true }).where(eq(schema.services.slug, "deep-cleaning"));
    await removeServiceImage(db, admin, "deep-cleaning");
    expect((await fetchService(db, "deep-cleaning"))?.imageId).toBeUndefined();
    expect(await db.select().from(schema.media)).toHaveLength(0);
  });
});

describe("service categories", () => {
  it("admins can add and edit categories, and move a service into one", async () => {
    const admin = await makeUser("admin");
    await saveCategory(db, admin, { slug: "outdoor", name: "Outdoor", audience: "both", description: "Gardens and patios", sortOrder: 5 });
    await saveCategory(db, admin, { slug: "outdoor", name: "Outdoor & Garden", audience: "both", description: "", sortOrder: 6 });
    const cats = await fetchCategories(db);
    expect(cats.find((c) => c.slug === "outdoor")).toMatchObject({ name: "Outdoor & Garden", sortOrder: 6 });
    await updateService(db, admin, "floor-care", { name: "Floor Care", summary: "Summary text", description: "A long enough description.", idealFor: "", includes: "Scrubbing", excludes: "", extraCharges: "", pricingNote: "", pricingModel: "inspection", minNoticeHours: "72", durationMinutes: "240", enabled: true, popular: false, categorySlug: "outdoor" });
    expect((await fetchService(db, "floor-care"))?.categorySlug).toBe("outdoor");
    expect(await code(updateService(db, admin, "floor-care", { name: "Floor Care", summary: "Summary text", description: "A long enough description.", idealFor: "", includes: "x", excludes: "", extraCharges: "", pricingNote: "", pricingModel: "inspection", minNoticeHours: "72", durationMinutes: "240", enabled: true, popular: false, categorySlug: "nope" }))).toBe("validation");
  });
  it("refuses to delete a category that still has services, and validates input and permission", async () => {
    const admin = await makeUser("admin");
    expect(await code(deleteCategory(db, admin, "residential"))).toBe("conflict");
    await saveCategory(db, admin, { slug: "empty-one", name: "Empty One", audience: "both", description: "", sortOrder: 0 });
    await deleteCategory(db, admin, "empty-one");
    expect((await fetchCategories(db)).some((c) => c.slug === "empty-one")).toBe(false);
    expect(await code(saveCategory(db, admin, { slug: "Bad Slug", name: "X Name", audience: "both", description: "", sortOrder: 0 }))).toBe("validation");
    expect(await code(saveCategory(db, await makeUser("manager"), { slug: "ok-slug", name: "Fine", audience: "both", description: "", sortOrder: 0 }))).toBe("forbidden");
    expect(await code(deleteCategory(db, await makeUser("manager"), "residential"))).toBe("forbidden");
  });
});

async function completedBooking(over: Record<string, unknown> = {}) {
  const r = await createBooking(db, bookingPayload(over), NOW);
  const id = await idOf(r.reference);
  const manager = await makeUser("manager");
  await transitionBooking(db, manager, id, "confirmed");
  const staff = await makeStaff();
  await assignStaff(db, manager, id, staff.staffId);
  await transitionBooking(db, staff.user, id, "in_progress");
  await transitionBooking(db, staff.user, id, "completed");
  return { ...r, id, manager };
}

describe("reviews and moderation", () => {
  it("only completed bookings can be reviewed, once, with the private token", async () => {
    const open = await createBooking(db, bookingPayload(), NOW);
    expect(await code(submitReview(db, open.reference, open.accessToken, { rating: 5 }))).toBe("conflict");
    const done = await completedBooking();
    expect(await code(submitReview(db, done.reference, "wrong-token-value", { rating: 5 }))).toBe("not_found");
    expect(await code(submitReview(db, done.reference, done.accessToken, { rating: 9 }))).toBe("validation");
    expect(await code(submitReview(db, done.reference, done.accessToken, { rating: 0 }))).toBe("validation");
    await submitReview(db, done.reference, done.accessToken, { rating: 5, comment: "Spotless!" });
    expect(await code(submitReview(db, done.reference, done.accessToken, { rating: 1 }))).toBe("conflict");
    expect((await getBookingForCustomer(db, done.reference, done.accessToken))?.review).toMatchObject({ rating: 5, approved: false });
  });
  it("reviews stay hidden until staff approve them; hiding removes them again; first name only", async () => {
    const done = await completedBooking({ customerName: "Ngozi Adeyemi-Bello" });
    await submitReview(db, done.reference, done.accessToken, { rating: 4, comment: "Very good." });
    expect(await listApprovedReviews(db)).toHaveLength(0);
    const [pending] = await listReviewsForModeration(db);
    expect(pending).toMatchObject({ approved: false, rating: 4 });
    expect(await code(setReviewApproved(db, await makeUser("cleaner"), pending.id, true))).toBe("forbidden");
    await setReviewApproved(db, done.manager, pending.id, true);
    const shown = await listApprovedReviews(db);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ firstName: "Ngozi", rating: 4, comment: "Very good." });
    expect(JSON.stringify(shown)).not.toMatch(/Adeyemi|phone|\+234/);
    expect(await listApprovedReviews(db, { serviceSlug: "deep-cleaning" })).toHaveLength(0);
    await setReviewApproved(db, done.manager, pending.id, false);
    expect(await listApprovedReviews(db)).toHaveLength(0);
    expect((await db.select().from(schema.auditLogs)).filter((l) => l.action.startsWith("review.")).length).toBe(2);
  });
});

describe("customer cancel and reschedule", () => {
  it("lets a customer cancel with enough notice, frees the slot, notifies, and records who did it", async () => {
    const r = await createBooking(db, bookingPayload({ customerEmail: "c@example.test" }), NOW);
    await customerCancel(db, r.reference, r.accessToken, "Plans changed", NOW);
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.reference, r.reference));
    expect(b).toMatchObject({ status: "cancelled", cancelReason: "Cancelled by customer: Plans changed" });
    const hist = await db.select().from(schema.bookingStatusHistory).where(eq(schema.bookingStatusHistory.bookingId, b.id));
    expect(hist.at(-1)).toMatchObject({ toStatus: "cancelled", actorId: null });
    expect((await db.select().from(schema.notifications)).some((n) => n.template === "booking_cancelled")).toBe(true);
    expect(await code(customerCancel(db, r.reference, r.accessToken, undefined, NOW))).toBe("conflict"); // already cancelled
  });
  it("blocks changes too close to the start, with someone else's token, or after payment", async () => {
    const r = await createBooking(db, bookingPayload(), NOW);
    const other = await createBooking(db, bookingPayload(), NOW);
    expect(await code(customerCancel(db, r.reference, other.accessToken, undefined, NOW))).toBe("not_found");
    expect(await code(customerCancel(db, r.reference, undefined, undefined, NOW))).toBe("not_found");
    expect(await code(customerCancel(db, r.reference, r.accessToken, undefined, new Date("2030-01-14T12:00:00Z")))).toBe("conflict"); // < 24h before 08:00 Lagos on the 15th
    expect(await code(customerReschedule(db, r.reference, r.accessToken, "2030-01-22", "morning", new Date("2030-01-14T12:00:00Z")))).toBe("conflict");

    const id = await idOf(r.reference);
    await transitionBooking(db, await makeUser("manager"), id, "confirmed");
    await recordManualPayment(db, await makeUser("manager"), id, 100_000, "deposit");
    expect(await code(customerCancel(db, r.reference, r.accessToken, undefined, NOW))).toBe("conflict");
    expect((await db.select().from(schema.bookings).where(eq(schema.bookings.id, id)))[0].status).toBe("confirmed");
    await expect(customerReschedule(db, r.reference, r.accessToken, "2030-01-22", "midday", NOW)).resolves.toBeTruthy(); // reschedule is still allowed
  });
  it("reschedules to an available slot, respects capacity, notice and the 2-change limit, and moves the cleaner", async () => {
    const r = await createBooking(db, bookingPayload(), NOW);
    const id = await idOf(r.reference);
    const manager = await makeUser("manager");
    await transitionBooking(db, manager, id, "confirmed");
    const staff = await makeStaff();
    await assignStaff(db, manager, id, staff.staffId);

    await customerReschedule(db, r.reference, r.accessToken, "2030-01-16", "midday", NOW);
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b).toMatchObject({ scheduledDate: "2030-01-16", timeSlotId: "midday", status: "scheduled" });
    const [asg] = await db.select().from(schema.bookingAssignments).where(eq(schema.bookingAssignments.bookingId, id));
    expect(asg.startsAt.toISOString()).toBe("2030-01-16T10:00:00.000Z");
    expect(await code(customerReschedule(db, r.reference, r.accessToken, "2030-01-13", "morning", NOW))).toBe("slot_unavailable"); // Sunday
    expect(await code(customerReschedule(db, r.reference, r.accessToken, "2030-01-02", "morning", NOW))).toBe("slot_unavailable"); // inside service minimum notice
    await customerReschedule(db, r.reference, r.accessToken, "2030-01-17", "midday", NOW);
    expect(await code(customerReschedule(db, r.reference, r.accessToken, "2030-01-18", "midday", NOW))).toBe("conflict"); // third attempt
    const notes = (await db.select().from(schema.bookingStatusHistory).where(eq(schema.bookingStatusHistory.bookingId, id))).filter((h) => h.note?.startsWith("Customer rescheduled"));
    expect(notes).toHaveLength(2);
  });
  it("cannot reschedule into a full slot", async () => {
    await db.update(schema.timeSlots).set({ capacity: 1 }).where(eq(schema.timeSlots.id, "midday"));
    await createBooking(db, bookingPayload({ timeSlotId: "midday", date: "2030-01-16" }), NOW);
    const r = await createBooking(db, bookingPayload(), NOW);
    expect(await code(customerReschedule(db, r.reference, r.accessToken, "2030-01-16", "midday", NOW))).toBe("slot_unavailable");
  });
  it("respects a configurable notice window and exposes the options to the confirmation page", async () => {
    const r = await createBooking(db, bookingPayload(), NOW);
    let view = await getBookingForCustomer(db, r.reference, r.accessToken);
    expect(view?.changes).toMatchObject({ canCancel: true, canReschedule: true, noticeHours: 24 });
    await db.insert(schema.businessSettings).values({ key: "booking", value: { operatingDays: [1, 2, 3, 4, 5, 6], maxAdvanceDays: 3650, customerChangeNoticeHours: 100000 } }).onConflictDoUpdate({ target: schema.businessSettings.key, set: { value: { operatingDays: [1, 2, 3, 4, 5, 6], maxAdvanceDays: 3650, customerChangeNoticeHours: 100000 } } });
    view = await getBookingForCustomer(db, r.reference, r.accessToken);
    expect(view?.changes.canCancel).toBe(false);
    expect(view?.changes.cancelBlockedReason).toMatch(/contact us/i);
  });
});

describe("pay now readiness (customer view)", () => {
  it("shows the agreed price, paid amount and balance, and offers payment only once confirmed", async () => {
    const r = await createBooking(db, bookingPayload({ customerEmail: "pay@example.test" }), NOW);
    const id = await idOf(r.reference);
    let v = await getBookingForCustomer(db, r.reference, r.accessToken);
    expect(v?.finalKobo).toBeNull();
    const fake = { initialize: async () => ({ authorizationUrl: "https://checkout.example" }), verify: async () => { throw new Error("unused"); } };
    expect(await code(initializePayment(db, fake, r.reference, r.accessToken, "http://x"))).toBe("conflict"); // not confirmed yet
    await transitionBooking(db, await makeUser("manager"), id, "confirmed");
    v = await getBookingForCustomer(db, r.reference, r.accessToken);
    expect(v).toMatchObject({ finalKobo: 4_000_000, hasEmail: true, payment: { paidKobo: 0, outstandingKobo: 4_000_000 } });
    expect((await initializePayment(db, fake, r.reference, r.accessToken, "http://x")).authorizationUrl).toContain("checkout");
    await recordManualPayment(db, await makeUser("manager"), id, 1_000_000, "part");
    expect((await paymentSummary(db, id)).outstandingKobo).toBe(3_000_000);
  });
});
