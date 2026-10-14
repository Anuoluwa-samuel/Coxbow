import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/booking-status";

const TONE: Record<BookingStatus, string> = {
  requested: "bg-brass-soft text-forest-950", quoted: "bg-peach-100 text-peach-700", confirmed: "bg-sky-100 text-sky-700",
  scheduled: "bg-sage-200 text-forest-900", in_progress: "bg-violet-100 text-violet-700", completed: "bg-forest-800 text-white",
  rejected: "bg-danger-soft text-danger", cancelled: "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize", TONE[status])}>{status.replace("_", " ")}</span>;
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-3xl"><h1 className="text-3xl">{title}</h1>{sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}</div>
      {actions}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line/70 bg-paper p-5 shadow-card", className)}>
      {title ? <h2 className="mb-3 text-lg">{title}</h2> : null}
      {children}
    </section>
  );
}

const STAT_TONE = {
  green: "bg-sage-100 [&_.chip]:bg-sage-200 [&_.chip]:text-forest-800",
  sky: "bg-sky-100 [&_.chip]:bg-white [&_.chip]:text-sky-700",
  violet: "bg-violet-100 [&_.chip]:bg-white [&_.chip]:text-violet-700",
  peach: "bg-peach-100 [&_.chip]:bg-white [&_.chip]:text-peach-700",
  plain: "bg-paper [&_.chip]:bg-sage-100 [&_.chip]:text-forest-800",
} as const;

export function Stat({ label, value, hint, icon: Icon, tone = "plain", size = "md" }: {
  label: string; value: string | number; hint?: string; icon?: React.ComponentType<{ className?: string }>; tone?: keyof typeof STAT_TONE; size?: "md" | "sm";
}) {
  return (
    <div className={cn("flex items-start gap-4 rounded-[var(--radius-card)] border border-line/70 p-5 text-forest-950 shadow-card", STAT_TONE[tone])}>
      {Icon ? <span className="chip flex size-12 shrink-0 items-center justify-center rounded-2xl"><Icon className="size-6" aria-hidden /></span> : null}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-soft">{label}</p>
        <p className={cn("mt-0.5 font-extrabold tracking-tight", size === "md" ? "text-3xl" : "text-2xl")}>{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-mute">{hint}</p> : null}
      </div>
    </div>
  );
}

export const tableCls = "w-full text-left text-sm";
export const thCls = "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mute";
export const tdCls = "px-3 py-3 align-top";
