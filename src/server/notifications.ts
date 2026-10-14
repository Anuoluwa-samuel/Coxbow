import { eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { bookings, customers, notifications, services, timeSlots } from "./db/schema";
import { accessTokenFor } from "./bookings";
import { formatNaira } from "@/lib/money";

export interface EmailMessage { to: string; subject: string; text: string }
export interface EmailProvider { send(m: EmailMessage): Promise<void> }

/** Development provider: logs the subject only. Never logs recipients' addresses or bodies. */
export const consoleEmailProvider: EmailProvider = {
  async send(m) { console.info(`[email:console] "${m.subject}" (recipient hidden)`); },
};

/** Resend REST API: POST https://api.resend.com/emails with a Bearer API key. */
export function resendEmailProvider(apiKey: string, from: string): EmailProvider {
  return {
    async send(m) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
    },
  };
}

export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "resend") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM");
    return resendEmailProvider(key, from);
  }
  return consoleEmailProvider;
}

interface Ctx { reference: string; name: string; service: string; date: string; slot: string; link: string; finalKobo: number | null; estimateKobo: number | null; reason: string | null }

const TEMPLATES: Record<string, (c: Ctx) => { subject: string; body: string }> = {
  booking_received: (c) => ({
    subject: `We received your request (${c.reference})`,
    body: `Hi ${c.name},\n\nThanks for your request for ${c.service} on ${c.date} (${c.slot}).\nYour reference is ${c.reference}.\n\nThis is not yet confirmed. We will review it and contact you. ${c.estimateKobo ? `Estimated price: ${formatNaira(c.estimateKobo)} (not final).` : "We will send a quotation."}\n\nView or track your booking: ${c.link}`,
  }),
  booking_confirmed: (c) => ({
    subject: `Booking confirmed (${c.reference})`,
    body: `Hi ${c.name},\n\nYour ${c.service} booking for ${c.date} (${c.slot}) is confirmed${c.finalKobo ? ` at ${formatNaira(c.finalKobo)}` : ""}.\n\nDetails and payment: ${c.link}`,
  }),
  booking_scheduled: (c) => ({
    subject: `A cleaner is assigned (${c.reference})`,
    body: `Hi ${c.name},\n\nA cleaner has been assigned for ${c.date} (${c.slot}).\n\nDetails: ${c.link}`,
  }),
  booking_completed: (c) => ({ subject: `Job completed (${c.reference})`, body: `Hi ${c.name},\n\nYour ${c.service} job is complete. Thank you.\n\nDetails: ${c.link}` }),
  booking_cancelled: (c) => ({ subject: `Booking cancelled (${c.reference})`, body: `Hi ${c.name},\n\nYour booking ${c.reference} has been cancelled${c.reason ? `: ${c.reason}` : ""}.\n\nIf this is unexpected, please contact us.` }),
  booking_rejected: (c) => ({ subject: `We could not accept your request (${c.reference})`, body: `Hi ${c.name},\n\nUnfortunately we could not accept booking ${c.reference}${c.reason ? `: ${c.reason}` : ""}. Please contact us for alternatives.` }),
};

/**
 * Sends queued notifications. Rows are claimed with FOR UPDATE SKIP LOCKED so concurrent
 * dispatchers never send the same message twice. Failures are recorded, never thrown to callers:
 * a mail outage must not break a booking.
 */
export async function dispatchPending(db: Db, siteUrl: string, provider: EmailProvider = getEmailProvider(), limit = 20) {
  let sent = 0, failed = 0;
  await db.transaction(async (tx) => {
    const queued = await tx.select().from(notifications).where(eq(notifications.status, "queued")).limit(limit).for("update", { skipLocked: true });
    for (const n of queued) {
      const tpl = TEMPLATES[n.template];
      try {
        if (!tpl || !n.bookingId) throw new Error("Unknown template or missing booking");
        const [row] = await tx
          .select({ b: bookings, name: customers.fullName, service: services.name, slot: timeSlots.label })
          .from(bookings)
          .innerJoin(customers, eq(customers.id, bookings.customerId))
          .innerJoin(services, eq(services.id, bookings.serviceId))
          .innerJoin(timeSlots, eq(timeSlots.id, bookings.timeSlotId))
          .where(eq(bookings.id, n.bookingId));
        const { subject, body } = tpl({
          reference: row.b.reference, name: row.name.split(" ")[0], service: row.service, date: row.b.scheduledDate, slot: row.slot,
          link: `${siteUrl}/book/confirmation/${row.b.reference}?t=${accessTokenFor(row.b.id)}`,
          finalKobo: row.b.finalKobo, estimateKobo: row.b.estimateKobo, reason: row.b.cancelReason,
        });
        await provider.send({ to: n.recipient, subject, text: body });
        await tx.update(notifications).set({ status: "sent", sentAt: new Date(), error: null }).where(eq(notifications.id, n.id));
        sent++;
      } catch (e) {
        await tx.update(notifications).set({ status: "failed", error: (e instanceof Error ? e.message : "error").slice(0, 300) }).where(eq(notifications.id, n.id));
        failed++;
      }
    }
  });
  return { sent, failed };
}
