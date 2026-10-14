import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "./db/client";
import { bookings } from "./db/schema";
import { fetchBookingSettings, fetchService, fetchTimeSlots } from "./catalog-db";
import { checkSlot, type SlotCheck } from "@/lib/availability";
import { AppError } from "./errors";
import type { SlotInfo } from "@/components/booking/types";

/** Statuses that occupy capacity in a slot. Cancelled, rejected and completed bookings free it. */
export const HOLDING_STATUSES = ["requested", "quoted", "confirmed", "scheduled", "in_progress"] as const;

export async function countHeld(db: Db | Tx, date: string, slotId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.scheduledDate, date), eq(bookings.timeSlotId, slotId), inArray(bookings.status, [...HOLDING_STATUSES])));
  return row.n;
}

const REASONS: Record<Exclude<SlotCheck, { ok: true }>["reason"], string> = {
  past_notice: "Not enough notice",
  closed_day: "Closed",
  too_far: "Too far ahead",
  full: "Fully booked",
};

export function isValidDateString(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = new Date(`${d}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
}

export async function getSlotAvailability(db: Db, serviceSlug: string, date: string, now = new Date()): Promise<SlotInfo[]> {
  if (!isValidDateString(date)) throw new AppError("validation", "Invalid date");
  const service = await fetchService(db, serviceSlug);
  if (!service) throw new AppError("not_found", "Service not found");
  const [slots, settings] = await Promise.all([fetchTimeSlots(db), fetchBookingSettings(db)]);
  return Promise.all(
    slots.map(async (slot) => {
      const bookedCount = await countHeld(db, date, slot.id);
      const r = checkSlot({ date, slot, now, minNoticeHours: service.minNoticeHours, operatingDays: settings.operatingDays, maxAdvanceDays: settings.maxAdvanceDays, bookedCount, capacity: slot.capacity });
      return r.ok ? { id: slot.id, label: slot.label, available: true } : { id: slot.id, label: slot.label, available: false, reason: REASONS[r.reason] };
    }),
  );
}
