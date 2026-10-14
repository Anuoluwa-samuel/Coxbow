import { cn } from "@/lib/utils";

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
  /** Use "h1" for the page's main heading. */
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-brass">{eyebrow}</p> : null}
      <Tag className="text-balance text-3xl sm:text-4xl">{title}</Tag>
      {lead ? <p className="mt-4 text-lg text-ink-soft">{lead}</p> : null}
    </div>
  );
}
