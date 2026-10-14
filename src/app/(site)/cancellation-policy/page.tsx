import type { Metadata } from "next";
import { LegalDraftNotice, PageShell, Prose } from "@/components/site/page-shell";

export const metadata: Metadata = { title: "Cancellation and rescheduling", alternates: { canonical: "/cancellation-policy" } };

export default function CancellationPage() {
  return (
    <PageShell title="Cancellation and rescheduling policy">
      <LegalDraftNotice />
      <Prose>
        <h2>Rescheduling</h2>
        <p>You may request a new date or time by contacting us with your booking reference. Rescheduling is subject to availability. [Business to state minimum notice, e.g. X hours.]</p>
        <h2>Cancellation</h2>
        <p>Cancel by contacting us with your booking reference. [Business to state cancellation windows, any fees, and refund timing.]</p>
        <h2>Quotations</h2>
        <p>Quotations remain valid for [business to state validity period]. Declining a quotation carries no charge.</p>
        <h2>If we cancel</h2>
        <p>If we must cancel or reschedule, we will contact you as soon as possible and refund any payment made for the cancelled service.</p>
      </Prose>
    </PageShell>
  );
}
