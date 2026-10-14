import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/section";
import { BookingWizard } from "@/components/booking/wizard";
import { listServiceAreas, listServices, listTimeSlots } from "@/server/catalog";
import { lagosDateString } from "@/lib/availability";

export const metadata: Metadata = {
  title: "Book a clean",
  description: "Book a cleaning or request a quotation in a few steps.",
  alternates: { canonical: "/book" },
};

async function Wizard({ searchParams }: { searchParams: PageProps<"/book">["searchParams"] }) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const [services, areas, timeSlots] = await Promise.all([listServices(), listServiceAreas(), listTimeSlots()]);
  return (
    <BookingWizard
      services={services}
      areas={areas}
      timeSlots={timeSlots}
      minDate={lagosDateString(new Date())}
      initialService={first(sp.service)}
      initialCity={first(sp.city)}
    />
  );
}

export default function BookPage(props: PageProps<"/book">) {
  return (
    <Container className="py-12 lg:py-16">
      <Suspense fallback={<p role="status" className="py-20 text-center text-ink-mute">Loading booking form…</p>}>
        <Wizard searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
