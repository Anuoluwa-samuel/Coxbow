import type { Metadata } from "next";
import Link from "next/link";
import { Container, SectionHeading } from "@/components/ui/section";
import { ServiceImage } from "@/components/ui/service-image";
import { priceLabel } from "@/components/home/sections";
import { listCategories, listServices } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Cleaning services",
  description: "Residential, commercial and specialised cleaning. See what each service includes and how it is priced.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const [services, categories] = await Promise.all([listServices(), listCategories()]);
  return (
    <Container className="py-14 lg:py-20">
      <SectionHeading as="h1" eyebrow="Services" title="Choose the clean that fits" lead="Every service shows its inclusions, exclusions and pricing approach before you commit." />
      <div className="mt-14 space-y-16">
        {categories.map((c) => {
          const list = services.filter((s) => s.categorySlug === c.slug);
          if (!list.length) return null;
          return (
            <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
              <h2 id={`cat-${c.slug}`} className="text-2xl">{c.name}</h2>
              <p className="mt-1 text-ink-soft">{c.description}</p>
              <ul className="mt-6 grid gap-5 md:grid-cols-2">
                {list.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/services/${s.slug}`} className="group grid h-full gap-5 rounded-[var(--radius-card)] border border-line bg-paper p-4 transition-all hover:border-sage-500 hover:shadow-card sm:grid-cols-[9rem_1fr]">
                      <ServiceImage service={s} className="aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-32" tone="sand" />
                      <div className="flex flex-col py-1">
                        <h3 className="text-xl group-hover:text-forest-700">{s.name}</h3>
                        <p className="mt-2 flex-1 text-sm text-ink-soft">{s.summary}</p>
                        <p className="mt-3 text-sm font-semibold text-forest-800">{priceLabel(s)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Container>
  );
}
