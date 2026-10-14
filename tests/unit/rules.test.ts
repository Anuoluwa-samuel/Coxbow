import { describe, expect, it } from "vitest";
import { normaliseNigerianPhone } from "@/lib/phone";
import { isServiceable } from "@/lib/service-area";
import { canTransition, isTerminal } from "@/lib/booking-status";
import { bookingInputSchema } from "@/lib/booking-schema";
import { checkSlot, lagosDateString, lagosInstant } from "@/lib/availability";
import { demoServiceAreas, demoTimeSlots } from "@/data/demo-catalog";

describe("phone", () => {
  it.each(["08012345678", "+2348012345678", "2348012345678", "0803 234 5678", "0901-234-5678"])("accepts %s", (p) => {
    expect(normaliseNigerianPhone(p)).toMatch(/^\+234[789][01]\d{8}$/);
  });
  it.each(["12345", "0601234567", "+441234567890", "080123456789", "abc"])("rejects %s", (p) => {
    expect(normaliseNigerianPhone(p)).toBeNull();
  });
});

describe("service area", () => {
  it("covers a listed neighbourhood", () => {
    expect(isServiceable(demoServiceAreas, { state: "Lagos", city: "Lekki", neighbourhood: "Ikate" })).toBe(true);
  });
  it("rejects an unlisted neighbourhood", () => {
    expect(isServiceable(demoServiceAreas, { state: "Lagos", city: "Lekki", neighbourhood: "Nowhere" })).toBe(false);
  });
  it("covers a whole city with no neighbourhood list", () => {
    expect(isServiceable(demoServiceAreas, { state: "Lagos", city: "Yaba" })).toBe(true);
  });
  it("rejects disabled areas and unknown cities", () => {
    expect(isServiceable(demoServiceAreas, { state: "Abuja (FCT)", city: "Wuse" })).toBe(false);
    expect(isServiceable(demoServiceAreas, { state: "Rivers", city: "Port Harcourt" })).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(isServiceable(demoServiceAreas, { state: "lagos", city: "YABA" })).toBe(true);
  });
});

describe("booking status transitions", () => {
  it("never confirms straight from completed/cancelled", () => {
    expect(canTransition("completed", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });
  it("does not skip approval to start work", () => {
    expect(canTransition("requested", "in_progress")).toBe(false);
    expect(canTransition("requested", "completed")).toBe(false);
    expect(canTransition("quoted", "scheduled")).toBe(false);
  });
  it("allows the happy path", () => {
    const path = ["requested", "quoted", "confirmed", "scheduled", "in_progress", "completed"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("marks terminal states", () => {
    expect(isTerminal("completed") && isTerminal("cancelled") && isTerminal("rejected")).toBe(true);
    expect(isTerminal("requested")).toBe(false);
  });
});

const valid = {
  idempotencyKey: "3f2b8c1e-8c0a-4c53-9b77-0e3a5d2f9a11",
  serviceSlug: "residential-cleaning",
  propertyType: "apartment",
  state: "Lagos",
  city: "Yaba",
  address: "12 Example Street",
  date: "2030-01-15",
  timeSlotId: "morning",
  customerName: "Ada Obi",
  customerPhone: "08012345678",
  consent: true,
};

describe("booking schema", () => {
  it("accepts a valid booking and normalises the phone", () => {
    const r = bookingInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.customerPhone).toBe("+2348012345678");
  });
  it("rejects missing consent, bad phone, bad date and short address", () => {
    expect(bookingInputSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...valid, customerPhone: "123" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...valid, date: "15/01/2030" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...valid, address: "x" }).success).toBe(false);
  });
  it("treats an empty email as absent but rejects a malformed one", () => {
    expect(bookingInputSchema.safeParse({ ...valid, customerEmail: "" }).success).toBe(true);
    expect(bookingInputSchema.safeParse({ ...valid, customerEmail: "nope" }).success).toBe(false);
  });
});

describe("availability", () => {
  const slot = demoTimeSlots[0];
  const now = new Date("2030-01-10T09:00:00Z");
  const base = { slot, now, minNoticeHours: 24, operatingDays: [1, 2, 3, 4, 5, 6], maxAdvanceDays: 60, bookedCount: 0, capacity: 2 };
  it("uses Africa/Lagos dates", () => {
    expect(lagosDateString(new Date("2030-01-10T23:30:00Z"))).toBe("2030-01-11");
    expect(lagosInstant("2030-01-11", 8).toISOString()).toBe("2030-01-11T07:00:00.000Z");
  });
  it("accepts a valid future slot", () => {
    expect(checkSlot({ ...base, date: "2030-01-15" })).toEqual({ ok: true });
  });
  it("rejects insufficient notice", () => {
    expect(checkSlot({ ...base, date: "2030-01-10" })).toEqual({ ok: false, reason: "past_notice" });
  });
  it("rejects closed days (Sunday 2030-01-13)", () => {
    expect(checkSlot({ ...base, date: "2030-01-13" })).toEqual({ ok: false, reason: "closed_day" });
  });
  it("rejects full slots", () => {
    expect(checkSlot({ ...base, date: "2030-01-15", bookedCount: 2 })).toEqual({ ok: false, reason: "full" });
  });
  it("rejects bookings too far ahead", () => {
    expect(checkSlot({ ...base, date: "2030-06-17", maxAdvanceDays: 30 })).toEqual({ ok: false, reason: "too_far" });
  });
});
