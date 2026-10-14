import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/booking-status";

const TONE: Record<BookingStatus, string> = {
  requested: "bg-brass-soft text-forest-950", quoted: "bg-warn-soft text-forest-950", confirmed: "bg-sage-200 text-forest-900",
  scheduled: "bg-sage-300 text-forest-950", in_progress: "bg-forest-700 text-white", completed: "bg-forest-900 text-white",
  rejected: "bg-danger-soft text-danger", cancelled: "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", TONE[status])}>{status.replace("_", " ")}</span>;
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl">{title}</h1>{sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}</div>
      {actions}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-paper p-5", className)}>
      {title ? <h2 className="mb-3 text-lg">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-3xl text-forest-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-mute">{hint}</p> : null}
    </div>
  );
}

export const tableCls = "w-full text-left text-sm";
export const thCls = "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mute";
export const tdCls = "px-3 py-3 align-top";
