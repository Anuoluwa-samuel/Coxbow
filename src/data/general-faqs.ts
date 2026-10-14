import type { Faq } from "@/lib/catalog-types";

/** Policy-neutral answers. Anything business-specific points to configurable policy pages. */
export const generalFaqs: Faq[] = [
  { q: "Is the price I see final?", a: "Not until we approve your booking. Prices shown during booking are estimates based on what you tell us. Where a job needs inspection, you receive a quotation first." },
  { q: "How do I know my booking was received?", a: "You are given a unique booking reference only after your request has been saved. Keep it to check status or contact us." },
  { q: "Can I reschedule or cancel?", a: "Yes, subject to our cancellation and rescheduling policy. Read it before you book so notice periods are clear." },
  { q: "What if my area is not listed?", a: "Contact us. We will tell you honestly whether we can serve your location rather than accepting a booking we cannot fulfil." },
  { q: "Do you provide cleaning materials?", a: "For most services you can choose whether the team brings materials or you supply them." },
  { q: "Do you serve businesses?", a: "Yes. Offices and commercial sites are handled through a custom quotation on the corporate page." },
];
