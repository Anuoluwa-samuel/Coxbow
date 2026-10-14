import Link from "next/link";
import { ArrowUpRight, Check, MapPin } from "lucide-react";
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

export function PopularServices({ services }: { services: Service[] }) {
  return (
    <section className="pt-24 lg:pt-28" aria-labelledby="popular-heading">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Services"
            title="Cleaning for the way you live and work"
            lead="Each service lists what is included, what is not, and how it is priced."
          />
          <ButtonLink href="/services" variant="outline">All services</ButtonLink>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/services/${s.slug}`}
                className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-paper p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-sage-500 hover:shadow-card"
              >
                {s.imageId ? <ServiceImage service={s} className="-mx-0 mb-4 aspect-[16/10]" /> : null}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl">{s.name}</h3>
                  <ArrowUpRight className="size-5 shrink-0 text-ink-mute transition-colors group-hover:text-forest-700" aria-hidden />
                </div>
                <p className="mt-3 flex-1 text-ink-soft">{s.summary}</p>
                <p className="mt-6 border-t border-line pt-4 text-sm font-semibold text-forest-800">{priceLabel(s)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

const steps = [
  { n: "01", title: "Tell us about the space", text: "Pick a service and describe the property: rooms, size and any add-ons." },
  { n: "02", title: "Choose where and when", text: "Enter your address and choose from time slots we can actually offer." },
  { n: "03", title: "Review price or quotation", text: "Fixed estimates are shown clearly. Jobs needing a look get a quotation first." },
  { n: "04", title: "We confirm, you're set", text: "You get a booking reference and updates as the booking is approved and scheduled." },
];

export function HowItWorks() {
  return (
    <section className="mt-28 bg-forest-950 py-20 text-sage-200" aria-labelledby="how-heading">
      <Container>
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-brass">How it works</p>
          <h2 id="how-heading" className="text-balance text-3xl !text-ivory sm:text-4xl">From request to clean, step by step</h2>
        </div>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-sage-500/40 pt-5">
              <span className="font-display text-3xl text-brass">{s.n}</span>
              <h3 className="mt-3 text-xl !text-ivory">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sage-300">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const commitments = [
  "Estimates are labelled as estimates. A final price is only confirmed once we approve your booking.",
  "Jobs that need inspection get a written quotation, not a made-up number.",
  "Time slots are checked against our schedule on the server before you get a reference.",
  "Your details are used to deliver your booking. See the privacy policy for how.",
];

export function Trust() {
  return (
    <section className="mt-28" aria-labelledby="trust-heading">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading eyebrow="How we work" title="Straightforward about price, scope and timing" />
          <ul id="trust-heading" className="mt-8 space-y-4">
            {commitments.map((c) => (
              <li key={c} className="flex gap-3 text-lg text-ink-soft">
                <Check className="mt-1.5 size-5 shrink-0 text-forest-700" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <PlaceholderImage label="Before and after: kitchen" tone="sage" className="aspect-[5/4]" />
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
    <section className="mt-28" aria-labelledby="areas-heading">
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
    <section className="mt-28" aria-labelledby="faq-heading">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading eyebrow="FAQs" title="Questions people ask before booking" />
        <FaqList faqs={faqs} />
      </Container>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mt-28">
      <Container>
        <div className="rounded-[1.5rem] bg-forest-800 px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl !text-ivory sm:text-4xl">Ready for a space that feels reset?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sage-200">Book online in a few minutes, or request a quotation for larger and specialised jobs.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/book" variant="light" size="lg">Book a clean</ButtonLink>
            <ButtonLink href="/contact" variant="outline" size="lg" className="border-sage-300/50 text-ivory hover:bg-white/10">Talk to us</ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function Reviews({ reviews }: { reviews: { rating: number; comment: string | null; service: string; firstName: string }[] }) {
  if (reviews.length === 0) return null; // never show placeholder testimonials
  return (
    <section className="mt-28" aria-labelledby="reviews-heading">
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
