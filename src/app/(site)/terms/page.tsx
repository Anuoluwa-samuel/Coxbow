import type { Metadata } from "next";
import { LegalDraftNotice, PageShell, Prose } from "@/components/site/page-shell";

export const metadata: Metadata = { title: "Terms and conditions", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <PageShell title="Terms and conditions">
      <LegalDraftNotice />
      <Prose>
        <h2>Bookings and quotations</h2>
        <p>Submitting a request does not guarantee a booking. A booking is confirmed only when we approve it and notify you. Prices shown during booking are estimates unless stated as confirmed.</p>
        <h2>Pricing and payment</h2>
        <p>Final prices are confirmed in writing. [Business to state payment timing, accepted methods and deposits.]</p>
        <h2>Access and safety</h2>
        <p>You agree to provide safe access to the property and accurate information about its size and condition. Additional charges may apply if conditions differ materially.</p>
        <h2>Liability and complaints</h2>
        <p>[Business to state liability limits, damage reporting window and complaint process.]</p>
      </Prose>
    </PageShell>
  );
}
