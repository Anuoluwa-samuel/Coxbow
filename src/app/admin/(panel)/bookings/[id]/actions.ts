"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { requirePermission, requireUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { nairaToKoboStr, runAction, str, type ActionState } from "@/server/action";
import { addBookingNote, assignStaff, rescheduleBooking, sendQuotation, transitionBooking, unassignStaff } from "@/server/workflow";
import { recordManualPayment, recordRefund } from "@/server/payments";
import { dispatchPending } from "@/server/notifications";
import { siteConfig } from "@/lib/site-config";
import type { BookingStatus } from "@/lib/booking-status";

const uuid = z.string().uuid();

function refresh(id: string) {
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  after(() => dispatchPending(db, siteConfig.url).catch(() => undefined));
}

/** Status-change actions. The actor is ALWAYS taken from the session, never from the form. */
export async function changeStatus(id: string, to: BookingStatus, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireUser();
    uuid.parse(id);
    await transitionBooking(db, actor, id, to, { reason: str(fd, "reason") || undefined, note: str(fd, "note") || undefined });
    refresh(id);
    return `Booking is now ${to.replace("_", " ")}.`;
  });
}

export async function quote(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("quotations.manage");
    const amountKobo = nairaToKoboStr(str(fd, "amount"));
    const valid = str(fd, "validUntil");
    await sendQuotation(db, actor, id, { amountKobo, notes: str(fd, "notes") || undefined, validUntil: valid ? new Date(`${valid}T23:59:59+01:00`) : undefined });
    refresh(id);
    return "Quotation sent.";
  });
}

export async function reschedule(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    await rescheduleBooking(db, actor, id, str(fd, "date"), str(fd, "slot"));
    refresh(id);
    return "Booking rescheduled.";
  });
}

export async function assign(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    await assignStaff(db, actor, id, uuid.parse(str(fd, "staffId")));
    refresh(id);
    return "Cleaner assigned.";
  });
}

export async function unassign(id: string, staffId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    await unassignStaff(db, actor, id, uuid.parse(staffId));
    refresh(id);
    return "Cleaner removed.";
  });
}

export async function addNote(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("notes.write");
    await addBookingNote(db, actor, id, str(fd, "body"));
    refresh(id);
    return "Note added.";
  });
}

export async function manualPayment(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("payments.record");
    const amount = nairaToKoboStr(str(fd, "amount"));
    if (!Number.isFinite(amount)) throw new AppError("validation", "Enter a valid amount");
    await recordManualPayment(db, actor, id, amount, str(fd, "note"));
    refresh(id);
    return "Payment recorded.";
  });
}

export async function refund(bookingId: string, paymentId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("payments.refund");
    const amount = nairaToKoboStr(str(fd, "amount"));
    if (!Number.isFinite(amount)) throw new AppError("validation", "Enter a valid amount");
    await recordRefund(db, actor, uuid.parse(paymentId), amount, str(fd, "reason"));
    refresh(bookingId);
    return "Refund recorded. Remember to complete it in your Paystack dashboard if it was an online payment.";
  });
}
