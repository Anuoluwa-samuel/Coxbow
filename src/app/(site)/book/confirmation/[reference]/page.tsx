import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { QuotationActions } from "@/components/booking/quotation-actions";
import { PayNow } from "@/components/booking/pay-now";
import { PaymentReturn } from "@/components/booking/payment-return";
import { ChangeBooking } from "@/components/booking/change-booking";
import { ReviewForm } from "@/components/booking/review-form";
import { paystackConfigured } from "@/server/paystack";
import { lagosDateString } from "@/lib/availability";
import { db } from "@/server/db/client";
import { getBookingForCustomer } from "@/server/bookings";
import { formatNaira } from "@/lib/money";
import { siteConfig, telLink, whatsappLink } from "@/lib/site-config";
import type { BookingStatus } from "@/lib/booking-status";

// Private page: never indexed, and the secret in the URL must not leak via the Referer header.
export const metadata: Metadata = { title: "Booking confirmation", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUS_COPY: Record<BookingStatus, { label: string; next: string }> = {
  requested: { label: "Request received", next: "Our team will review your request and contact you to confirm. Nothing is charged yet." },
  quoted: { label: "Quotation ready", next: "Review the quotation below. We will confirm your booking once you accept." },
  confirmed: { label: "Confirmed", next: "Your booking is confirmed. We will assign a cleaner and confirm the schedule." },
  scheduled: { label: "Scheduled", next: "A cleaner has been assigned. We will contact you if anything changes." },
  in_progress: { label: "In progress", next: "The team is on site." },
  completed: { label: "Completed", next: "Thank you for choosing us." },
  rejected: { label: "Not accepted", next: "We could not take this booking. Please contact us for alternatives." },
  cancelled: { label: "Cancelled", next: "This booking was cancelled." },
};

async function Details({ params, searchParams }: { params: PageProps<"/book/confirmation/[reference]">["params"]; searchParams: PageProps<"/book/confirmation/[reference]">["searchParams"] }) {
  const { reference } = await params;
  const sp = await searchParams;
  const token = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const payRef = Array.isArray(sp.reference) ? sp.reference[0] : sp.reference;
  const b = await getBookingForCustomer(db, reference, token);
  if (!b) notFound();
  const copy = STATUS_COPY[b.status];
  const outstanding = b.payment.outstandingKobo;
  const payable = (["confirmed", "scheduled", "in_progress", "completed"] as string[]).includes(b.status) && b.finalKobo !== null && (outstanding ?? 0) > 0;
  const wa = whatsappLink(`Hello, my booking reference is ${b.reference}.`);

  return (
    <Container className="max-w-2xl py-14 lg:py-20">
      <div className="flex items-center gap-3 text-forest-700"><CheckCircle2 className="size-8" aria-hidden /><p className="font-semibold">{copy.label}</p></div>
      <h1 className="mt-4 text-4xl">{b.requiresQuotation ? "Quotation request received" : "Booking request received"}</h1>
      <p className="mt-4 text-lg text-ink-soft">Thank you, {b.customerName.split(" ")[0]}. Keep your reference handy:</p>
      <p className="mt-2 inline-block rounded-[var(--radius-control)] bg-sage-100 px-4 py-2 font-mono text-2xl font-semibold tracking-wider text-forest-950">{b.reference}</p>

      <dl className="mt-8 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
        {([
          ["Service", b.serviceName],
          ["Requested date", b.scheduledDate],
          ["Time", b.timeSlotLabel],
          ["Address", `${b.address}, ${b.city}`],
        ] as const).map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[9rem_1fr]"><dt className="text-sm font-semibold text-ink-mute">{k}</dt><dd>{v}</dd></div>
        ))}
        <div className="grid gap-1 px-5 py-3 sm:grid-cols-[9rem_1fr]">
          <dt className="text-sm font-semibold text-ink-mute">Price</dt>
          <dd>
            {b.finalKobo !== null ? <>Confirmed: <strong>{formatNaira(b.finalKobo)}</strong></>
              : b.estimateKobo !== null ? <>Estimate: <strong>{formatNaira(b.estimateKobo)}</strong> <span className="text-sm text-ink-soft">(not final until approved)</span></>
              : <>To be quoted</>}
          </dd>
        </div>
      </dl>

      <section className="mt-8 rounded-[var(--radius-card)] bg-sage-100 p-6" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-xl">What happens next</h2>
        <p className="mt-2 text-ink-soft">{copy.next}</p>
      </section>

      {b.quotation && b.quotation.status === "sent" && token ? (
        <section className="mt-8 rounded-[var(--radius-card)] border-2 border-brass bg-paper p-6" aria-labelledby="quote-heading">
          <h2 id="quote-heading" className="text-xl">Your quotation</h2>
          <p className="mt-2 font-display text-4xl text-forest-950">{formatNaira(b.quotation.amountKobo)}</p>
          {b.quotation.notes ? <p className="mt-3 text-ink-soft">{b.quotation.notes}</p> : null}
          {b.quotation.validUntil ? <p className="mt-2 text-sm text-ink-mute">Valid until {b.quotation.validUntil.toLocaleDateString("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" })}</p> : null}
          <div className="mt-5"><QuotationActions reference={b.reference} token={token} /></div>
        </section>
      ) : null}
      {b.quotation?.status === "accepted" ? <p className="mt-8 rounded-[var(--radius-control)] bg-sage-100 p-4 font-medium">You accepted the quotation of {formatNaira(b.quotation.amountKobo)}. We will confirm your booking shortly.</p> : null}

      {payRef && token ? <PaymentReturn bookingReference={b.reference} token={token} paymentReference={payRef} /> : null}

      {b.finalKobo !== null && b.status !== "cancelled" && b.status !== "rejected" ? (
        <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-paper p-6" aria-labelledby="pay-heading">
          <h2 id="pay-heading" className="text-xl">Payment</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Agreed price</dt><dd>{formatNaira(b.finalKobo)}</dd></div>
            <div className="flex justify-between"><dt>Paid</dt><dd>{formatNaira(b.payment.netPaidKobo)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Balance</dt><dd>{formatNaira(outstanding ?? 0)}</dd></div>
          </dl>
          {payable && token ? (
            <div className="mt-4">
              {paystackConfigured() && b.hasEmail ? <PayNow reference={b.reference} token={token} label={`Pay ${formatNaira(outstanding ?? 0)} now`} />
                : <p className="text-sm text-ink-soft">{!paystackConfigured() ? "Online payment is not available yet. Please contact us to arrange payment." : "Add an email address to pay online. Please contact us and we will add it."}</p>}
            </div>
          ) : (outstanding ?? 0) === 0 ? <p className="mt-3 text-sm font-medium text-forest-700">Paid in full. Thank you.</p> : null}
        </section>
      ) : null}

      {token && (b.changes.canReschedule || b.changes.canCancel || (["requested", "quoted", "confirmed", "scheduled"] as string[]).includes(b.status)) ? (
        <ChangeBooking reference={b.reference} token={token} serviceSlug={b.serviceSlug} minDate={lagosDateString(new Date())} canReschedule={b.changes.canReschedule} canCancel={b.changes.canCancel}
          rescheduleBlockedReason={b.changes.rescheduleBlockedReason} cancelBlockedReason={b.changes.cancelBlockedReason} noticeHours={b.changes.noticeHours} />
      ) : null}

      {b.status === "completed" && token ? (
        b.review ? <p className="mt-8 rounded-[var(--radius-control)] bg-sage-100 p-4 text-sm font-medium">Thank you for your review ({b.review.rating}/5){b.review.approved ? "" : ". It will appear on our site once our team has checked it."}</p>
          : <ReviewForm reference={b.reference} token={token} />
      ) : null}

      <section className="mt-8" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl">Questions?</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <ButtonLink href={telLink()} variant="outline">Call {siteConfig.phone}</ButtonLink>
          {wa ? <ButtonLink href={wa} variant="outline">WhatsApp</ButtonLink> : null}
          <ButtonLink href={`mailto:${siteConfig.email}?subject=Booking%20${b.reference}`} variant="outline">Email</ButtonLink>
        </div>
      </section>
    </Container>
  );
}

export default function ConfirmationPage(props: PageProps<"/book/confirmation/[reference]">) {
  return (
    <Suspense fallback={<p role="status" className="py-24 text-center text-ink-mute">Loading your booking…</p>}>
      <Details params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
