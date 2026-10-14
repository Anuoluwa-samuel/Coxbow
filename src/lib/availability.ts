import type { TimeSlot } from "./catalog-types";

/** Calendar day (YYYY-MM-DD) in Africa/Lagos for a given instant. Lagos has no DST (UTC+1). */
export function lagosDateString(d: Date): string {
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** UTC instant for a Lagos-local date and hour. */
export function lagosInstant(date: string, hour: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 1, 0, 0));
}

export interface SlotCheckInput {
  date: string;
  slot: TimeSlot;
  now: Date;
  minNoticeHours: number;
  /** Days of week (0=Sun) the business operates. */
  operatingDays: number[];
  maxAdvanceDays: number;
  /** Number of confirmed/active bookings already holding this slot. */
  bookedCount: number;
  /** Max concurrent jobs per slot (e.g. number of available crews). */
  capacity: number;
}

export type SlotCheck = { ok: true } | { ok: false; reason: "past_notice" | "closed_day" | "too_far" | "full" };

export function checkSlot(i: SlotCheckInput): SlotCheck {
  const start = lagosInstant(i.date, i.slot.startHour);
  if (start.getTime() < i.now.getTime() + i.minNoticeHours * 3_600_000) return { ok: false, reason: "past_notice" };
  const dow = new Date(`${i.date}T12:00:00Z`).getUTCDay();
  if (!i.operatingDays.includes(dow)) return { ok: false, reason: "closed_day" };
  if (start.getTime() > i.now.getTime() + i.maxAdvanceDays * 86_400_000) return { ok: false, reason: "too_far" };
  if (i.bookedCount >= i.capacity) return { ok: false, reason: "full" };
  return { ok: true };
}
