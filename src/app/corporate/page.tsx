import type { Metadata } from "next";
import { Building2, ClipboardCheck, CalendarClock } from "lucide-react";
import { PageShell } from "@/components/site/page-shell";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Corporate cleaning", description: "Request a custom quotation for offices, shops and facilities.", alternates: { canonical: "/corporate" } };

const points = [
  [Building2, "Scoped to your site", "We price per site, not per template, so you only pay for the scope you need."],
  [ClipboardCheck, "Written quotation", "You receive a quotation to review and accept before work is scheduled."],
  [CalendarClock, "Flexible schedules", "Request daily, weekly or out-of-hours visits in the form."],
] as const;

export default function CorporatePage() {
  return (
    <PageShell eyebrow="Corporate" title="Cleaning for offices and facilities" lead="Commercial work is quoted individually. Tell us about the premises and the schedule you need.">
      <ul className="grid gap-5 md:grid-cols-3">
        {points.map(([Icon, title, text]) => (
          <li key={title} className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
            <Icon className="size-6 text-forest-700" aria-hidden />
            <h2 className="mt-4 text-xl">{title}</h2>
            <p className="mt-2 text-sm text-ink-soft">{text}</p>
          </li>
        ))}
      </ul>
      <ButtonLink href="/book?service=office-cleaning" size="lg" className="mt-10">Request a corporate quotation</ButtonLink>
    </PageShell>
  );
}
