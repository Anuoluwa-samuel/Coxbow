import type { Metadata } from "next";
import { PageShell } from "@/components/site/page-shell";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Our work", description: "Completed cleaning projects.", alternates: { canonical: "/gallery" } };

// Real project photos are uploaded by the business via the admin dashboard (Phase 4).
// Until then we show an honest empty state instead of stock imagery.
export default function GalleryPage() {
  return (
    <PageShell eyebrow="Our work" title="Completed projects" lead="Before-and-after photos of real jobs will appear here.">
      <div className="rounded-[var(--radius-card)] border border-dashed border-sage-500 bg-paper p-10 text-center">
        <p className="font-display text-2xl text-forest-950">No projects published yet</p>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">We only show genuine work, with the customer&apos;s permission. Check back soon, or get in touch to ask about a specific type of job.</p>
        <ButtonLink href="/contact" className="mt-6">Contact us</ButtonLink>
      </div>
    </PageShell>
  );
}
