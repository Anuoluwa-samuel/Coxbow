import { ArrowRight, CalendarCheck, ClipboardList, Leaf, MessageSquareText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { PlaceholderImage } from "@/components/ui/placeholder-image";
import { QuickStart } from "./quick-start";
import type { Service, ServiceArea } from "@/lib/catalog-types";

const chips = [
  { Icon: ClipboardList, title: "Clear scope", text: "See what is and isn't included before you book." },
  { Icon: CalendarCheck, title: "Real availability", text: "Time slots are checked on our side, not guessed." },
  { Icon: MessageSquareText, title: "A reference to quote", text: "Every request gets its own booking reference." },
];

export function Hero({ services, areas }: { services: Service[]; areas: ServiceArea[] }) {
  const cities = [...new Set(areas.map((a) => `${a.city}, ${a.state}`))];
  return (
    <section className="relative overflow-hidden">
      <Container className="grid items-center gap-10 pb-10 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-12 lg:pt-16">
        <div>
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full bg-sage-200 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-forest-900">
            <Leaf className="size-3.5" aria-hidden /> Homes, apartments and offices
          </p>
          <h1 className="rise rise-2 text-balance text-[2.5rem] font-extrabold leading-[1.05] sm:text-6xl lg:text-[3.6rem]">
            A properly cleaned space, <span className="text-forest-800">booked in minutes.</span>
          </h1>
          <p className="rise rise-3 mt-6 max-w-xl text-lg text-ink-soft">
            Choose a service, pick a time, and see exactly what is included. Where a job needs a look first, we send a quotation instead of guessing.
          </p>
          <div className="rise rise-3 mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/book" size="lg">
              Book a clean <ArrowRight className="size-5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/services" size="lg" variant="outline">
              View services
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {chips.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 text-sm text-ink-soft">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-100 text-forest-800 ring-1 ring-sage-300"><Icon className="size-5" aria-hidden /></span>
                <span><strong className="block text-forest-950">{title}</strong>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <PlaceholderImage label="Cleaner at work in a bright living room" tone="sage" className="aspect-[5/6] w-full rounded-[2rem] max-lg:aspect-[16/11]" />
          <div className="absolute right-3 top-3 flex max-w-[11rem] items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 shadow-card sm:-right-3 sm:top-8">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-100 text-forest-800"><CalendarCheck className="size-5" aria-hidden /></span>
            <span className="text-sm font-bold leading-tight text-forest-950">Book online in minutes</span>
          </div>
        </div>
      </Container>
      <Container className="pb-4">
        <QuickStart services={services} cities={cities} />
      </Container>
    </section>
  );
}
