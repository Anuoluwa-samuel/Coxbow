import { Plus } from "lucide-react";
import type { Faq } from "@/lib/catalog-types";

/** Native <details> keeps this accessible and JavaScript-free. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {faqs.map((f) => (
        <details key={f.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-forest-950 [&::-webkit-details-marker]:hidden">
            {f.q}
            <Plus className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="mt-3 max-w-2xl text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
