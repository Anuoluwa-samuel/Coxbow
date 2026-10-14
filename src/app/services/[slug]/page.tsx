import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { Container } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { PlaceholderImage } from "@/components/ui/placeholder-image";
import { FaqList } from "@/components/site/faq-list";
import { priceLabel } from "@/components/home/sections";
import { getService, listServices } from "@/server/catalog";


export async function generateStaticParams() {
  return (await listServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = await getService(slug);
  if (!s) return {};
  return {
    title: s.name,
    description: s.summary,
    alternates: { canonical: `/services/${s.slug}` },
    openGraph: { title: s.name, description: s.summary },
  };
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) notFound();
  const all = await listServices();
  const related = service.relatedSlugs.map((r) => all.find((s) => s.slug === r)).filter((s) => s !== undefined);
  const bookHref = `/book?service=${service.slug}`;

  return (
    <>
      <Container className="grid gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:py-20">
        <div>
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-mute">
            <Link href="/services" className="hover:text-forest-800">Services</Link> <span aria-hidden>/</span> {service.name}
          </nav>
          <h1 className="text-balance text-4xl sm:text-5xl">{service.name}</h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft">{service.description}</p>
          <PlaceholderImage label={`${service.name} in progress`} tone="sage" className="mt-8 aspect-[16/9]" />
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-card">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brass">Pricing</p>
            <p className="mt-2 font-display text-3xl text-forest-950">{priceLabel(service)}</p>
            <p className="mt-2 text-sm text-ink-soft">{service.pricingNote}</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
              <Clock className="size-4" aria-hidden /> Typically about {Math.round(service.durationMinutes / 60)} hours. Minimum {service.minNoticeHours} hours notice.
            </p>
            <ButtonLink href={bookHref} size="lg" className="mt-6 w-full">
              {service.pricing.model === "inspection" || service.pricing.model === "corporate_quote" ? "Request a quotation" : "Book this service"}
            </ButtonLink>
            <p className="mt-3 text-xs text-ink-mute">Estimates are not final until your booking is approved.</p>
          </div>
        </aside>
      </Container>

      <Container className="grid gap-10 pb-6 md:grid-cols-2">
        <section aria-labelledby="inc">
          <h2 id="inc" className="text-2xl">What is included</h2>
          <ul className="mt-5 space-y-3">
            {service.includes.map((i) => (
              <li key={i} className="flex gap-3"><Check className="mt-1 size-5 shrink-0 text-forest-700" aria-hidden />{i}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="exc">
          <h2 id="exc" className="text-2xl">Not included</h2>
          <ul className="mt-5 space-y-3">
            {service.excludes.map((i) => (
              <li key={i} className="flex gap-3 text-ink-soft"><X className="mt-1 size-5 shrink-0 text-ink-mute" aria-hidden />{i}</li>
            ))}
          </ul>
          {service.extraCharges.length ? (
            <div className="mt-6 rounded-[var(--radius-control)] bg-warn-soft p-4 text-sm">
              <p className="font-semibold text-forest-950">Additional charges may apply</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
                {service.extraCharges.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      </Container>

      <Container className="mt-12 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="ideal">
          <h2 id="ideal" className="text-2xl">Ideal for</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {service.idealFor.map((i) => (
              <li key={i} className="rounded-full bg-sage-100 px-4 py-2 text-sm font-medium text-forest-900">{i}</li>
            ))}
          </ul>
        </section>
        {service.addons.length ? (
          <section aria-labelledby="addons">
            <h2 id="addons" className="text-2xl">Optional add-ons</h2>
            <ul className="mt-5 divide-y divide-line rounded-[var(--radius-control)] border border-line bg-paper">
              {service.addons.filter((a) => a.enabled).map((a) => (
                <li key={a.slug} className="flex justify-between px-4 py-3 text-sm"><span>{a.name}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-mute">Add-on prices are shown during booking.</p>
          </section>
        ) : null}
      </Container>

      {service.faqs.length ? (
        <Container className="mt-16">
          <h2 className="text-2xl">Frequently asked questions</h2>
          <div className="mt-6 max-w-3xl"><FaqList faqs={service.faqs} /></div>
        </Container>
      ) : null}

      {related.length ? (
        <Container className="mt-16">
          <h2 className="text-2xl">Related services</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/services/${r.slug}`} className="block rounded-[var(--radius-card)] border border-line bg-paper p-5 transition-colors hover:border-sage-500">
                  <h3 className="text-lg">{r.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{r.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      ) : null}
    </>
  );
}
