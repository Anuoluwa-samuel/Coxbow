/**
 * Booking lifecycle. The server is the only authority on transitions; the UI only
 * uses this to decide which buttons to offer.
 *
 * requested -> quoted -> confirmed -> scheduled -> in_progress -> completed
 * Fixed-price bookings that need no quotation may go requested -> confirmed after
 * staff approval. Nothing becomes confirmed without an actor approving it.
 */
export const BOOKING_STATUSES = [
  "requested",
  "quoted",
  "confirmed",
  "scheduled",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  requested: ["quoted", "confirmed", "rejected", "cancelled"],
  quoted: ["quoted", "confirmed", "rejected", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "scheduled", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return transitions[from].includes(to);
}

export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return transitions[from];
}

export function isTerminal(status: BookingStatus): boolean {
  return transitions[status].length === 0;
}
