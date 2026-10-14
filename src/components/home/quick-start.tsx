import { Button } from "@/components/ui/button";
import type { Service } from "@/lib/catalog-types";

const select = "h-12 w-full rounded-[var(--radius-control)] border border-line bg-ivory px-3.5 text-sm text-charcoal focus:border-forest-700 focus:outline-none";

/** Plain GET form: works without JavaScript and pre-fills the booking flow. */
export function QuickStart({ services, cities }: { services: Service[]; cities: string[] }) {
  return (
    <form action="/book" method="get" className="rounded-[var(--radius-card)] border border-line bg-paper p-4 shadow-card sm:p-5" aria-label="Start a booking">
      <p className="mb-3 text-lg font-bold text-forest-950">Start your booking</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="qs-service" className="sr-only">Service</label>
          <select id="qs-service" name="service" defaultValue="" className={select}>
            <option value="" disabled>Choose a service</option>
            {services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="qs-city" className="sr-only">Area</label>
          <select id="qs-city" name="city" defaultValue="" className={select}>
            <option value="" disabled>Your area</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button type="submit" size="lg" className="h-12 sm:px-8">Continue</Button>
      </div>
    </form>
  );
}
