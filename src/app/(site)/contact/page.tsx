import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone, Clock } from "lucide-react";
import { PageShell } from "@/components/site/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig, telLink, whatsappLink } from "@/lib/site-config";

export const metadata: Metadata = { title: "Contact", description: "Call, WhatsApp or email us.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const wa = whatsappLink("Hello, I'd like to ask about a cleaning service.");
  const items = [
    { icon: Phone, label: "Call", value: siteConfig.phone, href: telLink() },
    ...(wa ? [{ icon: MessageCircle, label: "WhatsApp", value: "Chat with us", href: wa }] : []),
    { icon: Mail, label: "Email", value: siteConfig.email, href: `mailto:${siteConfig.email}` },
    { icon: MapPin, label: "Address", value: siteConfig.address },
    { icon: Clock, label: "Hours", value: siteConfig.hours },
  ];
  return (
    <PageShell eyebrow="Contact" title="Talk to us" lead="For a booking, the fastest route is the booking form. For questions, reach us any of these ways.">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper">
          {items.map(({ icon: Icon, label, value, href }) => (
            <li key={label} className="flex items-center gap-4 p-5">
              <Icon className="size-5 text-forest-700" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink-mute">{label}</p>
                {href ? <a href={href} className="font-semibold text-forest-900 hover:underline" rel="noopener">{value}</a> : <p>{value}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-[var(--radius-card)] bg-sage-100 p-8">
          <h2 className="text-2xl">Ready to book?</h2>
          <p className="mt-2 text-ink-soft">Pick a service and time, and get a booking reference straight away.</p>
          <ButtonLink href="/book" size="lg" className="mt-6">Book a clean</ButtonLink>
        </div>
      </div>
      {siteConfig.phoneIsPlaceholder ? <p className="mt-6 text-sm text-ink-mute">Contact details shown are placeholders until the business sets its own.</p> : null}
    </PageShell>
  );
}
