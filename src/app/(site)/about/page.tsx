import type { Metadata } from "next";
import { PageShell } from "@/components/site/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/ui/placeholder-image";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "About", description: `About ${siteConfig.name}.`, alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <PageShell eyebrow="About" title={`About ${siteConfig.name}`} lead="We clean homes and workplaces, and we try to be clear about scope, price and timing before any work starts.">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-4 text-ink-soft">
          <p>How we work is built into the booking process: every service lists inclusions and exclusions, estimates are labelled as estimates, and jobs that need inspection are quoted rather than guessed.</p>
          <p className="rounded-[var(--radius-control)] bg-warn-soft p-4 text-sm text-forest-950">
            <strong>Placeholder:</strong> the company story, founding year, team and any certifications or insurance details are supplied by the business owner. None are claimed until provided.
          </p>
          <ButtonLink href="/contact" variant="outline">Contact us</ButtonLink>
        </div>
        <PlaceholderImage label="The team" className="aspect-[4/3]" tone="sand" />
      </div>
    </PageShell>
  );
}
