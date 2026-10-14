import { cn } from "@/lib/utils";

/**
 * Honest stand-in for photography. Real project photos are supplied by the
 * business; until then this is clearly labelled rather than passing off stock
 * imagery as the company's own work.
 */
export function PlaceholderImage({
  label,
  className,
  tone = "sage",
}: {
  label: string;
  className?: string;
  tone?: "sage" | "forest" | "sand";
}) {
  const tones = {
    sage: "bg-sage-200 text-forest-800",
    forest: "bg-forest-800 text-sage-200",
    sand: "bg-sand text-ink-soft",
  } as const;
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${label}`}
      className={cn(
        "relative flex items-end overflow-hidden rounded-[var(--radius-card)] p-4",
        "[background-image:repeating-linear-gradient(135deg,transparent_0_14px,rgb(255_255_255/0.18)_14px_15px)]",
        tones[tone],
        className,
      )}
    >
      <span className="rounded-full bg-ivory/85 px-3 py-1 text-xs font-semibold text-forest-900">
        Photo placeholder · {label}
      </span>
    </div>
  );
}
