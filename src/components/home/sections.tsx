import Link from "next/link";
import { ArrowRight, Building2, CalendarCheck, Check, ClipboardCheck, ClipboardList, FileText, Home, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/ui/placeholder-image";
import { ServiceImage } from "@/components/ui/service-image";
import { FaqList } from "@/components/site/faq-list";
import type { Service, ServiceArea, Faq } from "@/lib/catalog-types";
import { formatNaira } from "@/lib/money";

export function priceLabel(s: Service): string {
  const p = s.pricing;
  if (p.model === "inspection") return "Quoted after review";
  if (p.model === "corporate_quote") return "Custom quotation";
  if (p.model === "by_size" && p.sizeTiers?.length) {
    const min = Math.min(...p.sizeTiers.map((t) => t.priceKobo));
    return `From ${formatNaira(min)}`;
  }
  if (p.baseKobo !== undefined) return `From ${formatNaira(p.baseKobo)}`;
  return "Ask for a quote";
}

const CATEGORY_ICON = { residential: Home, commercial: Building2, specialised: Sparkles } as const;

export function PopularServices({ services }: { services: Service[] }) {
  return (
    <section className="pt-14 lg:pt-20" aria-labelledby="popular-heading">
      <Container>
        <div className="rounded-[2rem] border border-line bg-paper p-5 shadow-card sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="popular-heading" className="text-2xl sm:text-3xl">Our cleaning services</h2>
              <p className="mt-1 text-ink-soft">Each service lists what is included, what is not, and how it is priced.</p>
            </div>
            <Link href="/services" className="inline-flex items-center gap-1 font-bold text-forest-800 hover:underline">View all services <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => {
              const Icon = CATEGORY_ICON[s.categorySlug as keyof typeof CATEGORY_ICON] ?? Sparkles;
              return (
                <li key={s.slug}>
                  <Link href={`/services/${s.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper transition-all duration-200 hover:-translate-y-1 hover:border-sage-500 hover:shadow-card">
                    <ServiceImage service={s} className="aspect-[4/3] rounded-none" tone="sand" />
                    <div className="relative flex flex-1 flex-col p-4 pt-7">
                      <span className="absolute -top-5 left-4 flex size-10 items-center justify-center rounded-full bg-white text-forest-800 shadow-card ring-1 ring-line"><Icon className="size-5" aria-hidden /></span>
                      <h3 className="text-lg">{s.name}</h3>
                      <p className="mt-1.5 flex-1 text-sm text-ink-soft">{s.summary}</p>
                      <p className="mt-4 text-sm font-bold text-forest-800">{priceLabel(s)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}

const reasons = [
  { Icon: ClipboardCheck, title: "Clear scope and pricing", text: "Every service lists inclusions and exclusions. Estimates are labelled as estimates." },
  { Icon: CalendarCheck, title: "Real availability", text: "Time slots are checked against our schedule before you receive a reference." },
  { Icon: FileText, title: "Quotations when it matters", text: "Jobs that need inspection get a written quotation, never an invented number." },
  { Icon: ShieldCheck, title: "Your details stay private", text: "Your details are used to deliver your booking. See the privacy policy." },
];

export function Trust() {
  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="trust-heading">
      <Container className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <PlaceholderImage label="Before and after: kitchen" tone="sage" className="aspect-[5/4] rounded-[2rem]" />
        <div>
          <h2 id="trust-heading" className="text-3xl sm:text-4xl">Why choose <span className="text-forest-800">us</span>?</h2>
          <ul className="mt-7 space-y-5">
            {reasons.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sage-100 text-forest-800 ring-1 ring-sage-300"><Icon className="size-6" aria-hidden /></span>
                <span><strong className="block text-lg text-forest-950">{title}</strong><span className="text-ink-soft">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

export function CtaBanner() {
  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="cta-heading">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-forest-950 via-forest-900 to-forest-950 px-6 py-12 sm:px-12">
          <div aria-hidden className="absolute -right-10 -top-16 size-64 rounded-full bg-forest-600/20" />
          <div aria-hidden className="absolute -bottom-20 right-24 size-56 rounded-full bg-brass/20" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 id="cta-heading" className="text-3xl !text-white sm:text-4xl">Ready for a cleaner, healthier space?</h2>
              <p className="mt-3 text-sage-200">Book online in a few minutes, or request a quotation for larger and specialised jobs.</p>
            </div>
            <ButtonLink href="/book" size="lg">Book now <ArrowRight className="size-5" aria-hidden /></ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

const steps = [
  { Icon: ClipboardList, title: "Tell us about the space", text: "Pick a service and describe the property: rooms, size and any add-ons." },
  { Icon: MapPin, title: "Choose where and when", text: "Enter your address and choose from time slots we can actually offer." },
  { Icon: FileText, title: "Review price or quotation", text: "Fixed estimates are shown clearly. Jobs needing a look get a quotation first." },
  { Icon: Check, title: "We confirm, you're set", text: "You get a booking reference and updates as it is approved and scheduled." },
];

export function HowItWorks() {
  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="how-heading">
      <Container>
        <h2 id="how-heading" className="text-3xl sm:text-4xl">How it works</h2>
        <p className="mt-2 text-ink-soft">Booking a clean is simple and quick.</p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ Icon, title, text }, i) => (
            <li key={title} className="relative rounded-[var(--radius-card)] border border-line bg-paper p-5 shadow-card">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-sage-100 text-forest-800"><Icon className="size-6" aria-hidden /></span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-forest-800">Step {i + 1}</p>
              <h3 className="mt-1 text-lg">{title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{text}</p>
              {i < steps.length - 1 ? <ArrowRight aria-hidden className="absolute -right-5 top-1/2 hidden size-5 -translate-y-1/2 text-sage-500 lg:block" /> : null}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export function Areas({ areas }: { areas: ServiceArea[] }) {
  const byState = areas.reduce<Record<string, ServiceArea[]>>((acc, a) => {
    (acc[a.state] ??= []).push(a);
    return acc;
  }, {});
  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="areas-heading">
      <Container>
        <SectionHeading
          eyebrow="Where we work"
          title="Service areas"
          lead="Availability is checked against your address when you book. If you are outside these areas, contact us and we will tell you honestly whether we can help."
        />
        <div id="areas-heading" className="mt-10 grid gap-6 md:grid-cols-2">
          {Object.entries(byState).map(([state, list]) => (
            <div key={state} className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
              <h3 className="text-xl">{state}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {list.map((a) => (
                  <li key={a.city} className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 text-sm font-medium text-forest-900">
                    <MapPin className="size-3.5" aria-hidden /> {a.city}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function HomeFaq({ faqs }: { faqs: Faq[] }) {
  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="faq-heading">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow="FAQs" title="Questions people ask before booking" />
        <FaqList faqs={faqs} />
      </Container>
    </section>
  );
}

export function Reviews({ reviews }: { reviews: { rating: number; comment: string | null; service: string; firstName: string }[] }) {
  if (reviews.length === 0) return null; // never show placeholder testimonials
  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="reviews-heading">
      <Container>
        <SectionHeading eyebrow="Customer reviews" title="What customers say" />
        <ul id="reviews-heading" className="mt-10 grid gap-5 md:grid-cols-3">
          {reviews.map((r, i) => (
            <li key={i} className="rounded-[var(--radius-card)] border border-line bg-paper p-6">
              <p aria-label={`${r.rating} out of 5 stars`} className="text-brass-text">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></p>
              {r.comment ? <p className="mt-3 text-ink-soft">{r.comment}</p> : null}
              <p className="mt-4 text-sm font-semibold text-forest-950">{r.firstName} <span className="font-normal text-ink-mute">· {r.service}</span></p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
