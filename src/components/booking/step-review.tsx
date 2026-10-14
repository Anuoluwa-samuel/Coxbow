import { formatNaira } from "@/lib/money";
import { calculatePrice } from "@/lib/pricing";
import type { Service, TimeSlot } from "@/lib/catalog-types";
import type { BookingDraft } from "./types";

export function priceFor(service: Service, d: BookingDraft) {
  try {
    return calculatePrice({ service, sizeSqm: d.sizeSqm ? Number(d.sizeSqm) : undefined, addonSlugs: d.addonSlugs });
  } catch {
    return null;
  }
}

export function PriceBox({ service, draft }: { service: Service; draft: BookingDraft }) {
  const price = priceFor(service, draft);
  if (!price) return <p className="text-danger">We could not calculate a price. Please go back and check your selections.</p>;
  if (price.kind === "quotation") {
    return (
      <div className="rounded-[var(--radius-control)] bg-warn-soft p-4">
        <p className="font-semibold text-forest-950">This will be a quotation request</p>
        <p className="mt-1 text-sm text-ink-soft">
          {price.reason === "size_out_of_range"
            ? "We need a size we can price, or to review your property first."
            : "This service is priced after review."}{" "}
          Your booking is not confirmed and nothing is charged. We will send a quotation for you to accept.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-control)] bg-sage-100 p-4">
      <p className="font-semibold text-forest-950">Estimated price (not final)</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt>{service.name}</dt><dd>{formatNaira(price.baseKobo)}</dd></div>
        {price.addonLines.map((l) => (
          <div key={l.slug} className="flex justify-between"><dt>{l.name}</dt><dd>+{formatNaira(l.priceKobo)}</dd></div>
        ))}
        <div className="flex justify-between border-t border-sage-300 pt-2 text-base font-semibold text-forest-950"><dt>Estimated total</dt><dd>{formatNaira(price.totalKobo)}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-ink-soft">The final price is confirmed when we approve your booking. You are not charged now.</p>
    </div>
  );
}

export function StepReview({ draft, service, slot }: { draft: BookingDraft; service: Service; slot?: TimeSlot }) {
  const rows: [string, string][] = [
    ["Service", service.name],
    ["Property", `${draft.propertyType}${draft.bedrooms !== "" ? `, ${draft.bedrooms} bed, ${draft.bathrooms} bath` : ""}${draft.sizeSqm ? `, ~${draft.sizeSqm} m²` : ""}`],
    ["Address", [draft.address, draft.neighbourhood, draft.city, draft.state].filter(Boolean).join(", ")],
    ["Date", draft.date],
    ["Time", slot?.label ?? draft.timeSlotId],
    ["Contact", `${draft.customerName}, ${draft.customerPhone}`],
  ];
  return (
    <div className="space-y-6">
      <dl className="divide-y divide-line rounded-[var(--radius-control)] border border-line bg-paper">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]">
            <dt className="text-sm font-semibold text-ink-mute">{k}</dt>
            <dd className="capitalize-first break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <PriceBox service={service} draft={draft} />
      <p className="text-sm text-ink-soft">Submitting sends a request. It is only confirmed after our team approves it and you receive confirmation.</p>
    </div>
  );
}
