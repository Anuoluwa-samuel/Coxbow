import { ArrowRight, CalendarCheck, ClipboardList, MessageSquareText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { PlaceholderImage } from "@/components/ui/placeholder-image";
import { QuickStart } from "./quick-start";
import type { Service, ServiceArea } from "@/lib/catalog-types";

export function Hero({ services, areas }: { services: Service[]; areas: ServiceArea[] }) {
  const cities = [...new Set(areas.map((a) => `${a.city}, ${a.state}`))];
  return (
    <section className="relative overflow-hidden">
      <Container className="grid items-center gap-12 pb-12 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-14 lg:pt-20">
        <div>
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full bg-sage-200 px-3.5 py-1.5 text-sm font-semibold text-forest-900">
            <span className="size-1.5 rounded-full bg-brass" aria-hidden />
            Homes, apartments and offices
          </p>
          <h1 className="rise rise-2 text-balance text-[2.6rem] leading-[1.03] sm:text-6xl lg:text-[4.25rem]">
            A properly cleaned space, booked in minutes.
          </h1>
          <p className="rise rise-3 mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
            Choose a service, pick a time, and see exactly what is included. Where a job needs a look first, we send a quotation instead of guessing.
          </p>
          <div className="rise rise-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book" size="lg">
              Book a clean <ArrowRight className="size-5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/services" size="lg" variant="outline">
              Explore services
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-4 text-sm text-ink-soft sm:grid-cols-3">
            {[
              [ClipboardList, "Clear scope", "See what is and isn't included before you book."],
              [CalendarCheck, "Real availability", "Time slots are checked on our side, not guessed."],
              [MessageSquareText, "A reference you can quote", "Every request gets a booking reference."],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof ClipboardList;
              return (
                <li key={title as string} className="flex gap-3">
                  <I className="mt-0.5 size-5 shrink-0 text-forest-700" aria-hidden />
                  <span>
                    <strong className="block text-forest-950">{title as string}</strong>
                    {text as string}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <PlaceholderImage label="Cleaner at work in a bright living room" tone="forest" className="aspect-[4/5] w-full max-lg:aspect-[16/10]" />
      </Container>
      <Container className="pb-4">
        <QuickStart services={services} cities={cities} />
      </Container>
    </section>
  );
}
