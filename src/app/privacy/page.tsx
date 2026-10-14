import type { Metadata } from "next";
import { LegalDraftNotice, PageShell, Prose } from "@/components/site/page-shell";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy policy">
      <LegalDraftNotice />
      <Prose>
        <p>{siteConfig.name} (&ldquo;we&rdquo;) collects only the information needed to handle your booking and quotation requests. We aim to comply with the Nigeria Data Protection Act 2023; the business owner must confirm registration and compliance obligations.</p>
        <h2>Information we collect</h2>
        <ul><li>Name, phone number and optional email address</li><li>Service address and access instructions</li><li>Booking details and payment status (we do not store card details)</li></ul>
        <h2>How we use it</h2>
        <ul><li>To schedule, perform and confirm your service</li><li>To send booking confirmations and updates</li><li>To process payments through our payment provider</li></ul>
        <h2>Sharing</h2>
        <p>Details are shared only with staff assigned to your job and service providers we use (payments, messaging, hosting). [Business to list providers.]</p>
        <h2>Retention and your rights</h2>
        <p>[Business to state retention period.] You may request access, correction or deletion of your data by contacting <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.</p>
      </Prose>
    </PageShell>
  );
}
