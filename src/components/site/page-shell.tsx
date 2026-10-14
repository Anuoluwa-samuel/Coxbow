import { Container } from "@/components/ui/section";

export function PageShell({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <Container className="py-14 lg:py-20">
      <header className="max-w-3xl">
        {eyebrow ? <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-brass">{eyebrow}</p> : null}
        <h1 className="text-balance text-4xl sm:text-5xl">{title}</h1>
        {lead ? <p className="mt-5 text-lg text-ink-soft">{lead}</p> : null}
      </header>
      {children ? <div className="mt-12">{children}</div> : null}
    </Container>
  );
}

/** Legal pages ship as clearly-marked drafts. They must be reviewed by a qualified professional. */
export function LegalDraftNotice() {
  return (
    <p role="note" className="mb-8 rounded-[var(--radius-control)] bg-warn-soft p-4 text-sm text-forest-950">
      <strong>Draft template.</strong> This page is a starting structure, not legal advice. The business owner must complete the bracketed items and have the text reviewed by a qualified professional before launch.
    </p>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl space-y-4 text-ink-soft [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_a]:font-semibold [&_a]:text-forest-800 [&_a]:underline">
      {children}
    </div>
  );
}
