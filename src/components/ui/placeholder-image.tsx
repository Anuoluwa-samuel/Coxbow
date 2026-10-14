import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Honest stand-in for photography. Real project photos are supplied by the business; until then this is
 * clearly labelled rather than passing off stock imagery as the company's own work.
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
    sage: "bg-gradient-to-br from-sage-100 via-sage-200 to-sky-100 text-forest-800",
    forest: "bg-gradient-to-br from-forest-950 via-forest-900 to-forest-800 text-sage-300",
    sand: "bg-gradient-to-br from-sky-100 via-sage-100 to-white text-forest-800",
  } as const;
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${label}`}
      className={cn("relative flex items-end overflow-hidden rounded-[var(--radius-card)] p-3", tones[tone], className)}
    >
      <Sparkles aria-hidden className="absolute left-1/2 top-1/2 size-1/4 min-h-8 min-w-8 max-h-24 max-w-24 -translate-x-1/2 -translate-y-1/2 opacity-30" />
      <span className="relative max-w-full truncate rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-forest-950 shadow-sm">Photo placeholder · {label}</span>
    </div>
  );
}
