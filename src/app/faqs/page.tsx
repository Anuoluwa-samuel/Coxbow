import type { Metadata } from "next";
import { PageShell } from "@/components/site/page-shell";
import { FaqList } from "@/components/site/faq-list";
import { generalFaqs } from "@/data/general-faqs";

export const metadata: Metadata = { title: "FAQs", description: "Answers to common questions about booking, pricing and cancellations.", alternates: { canonical: "/faqs" } };

export default function FaqPage() {
  return (
    <PageShell eyebrow="FAQs" title="Frequently asked questions">
      <div className="max-w-3xl"><FaqList faqs={generalFaqs} /></div>
    </PageShell>
  );
}
