import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "./types";

export function Progress({ current }: { current: number }) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  done && "bg-forest-800 text-ivory",
                  active && "bg-brass-text text-white",
                  !done && !active && "bg-sand text-ink-mute",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("hidden text-sm font-medium sm:block", active ? "text-forest-950" : "text-ink-mute")}>{label}</span>
              {i < STEPS.length - 1 ? <span aria-hidden className={cn("h-px flex-1", done ? "bg-forest-800" : "bg-line")} /> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-ink-mute sm:hidden">
        Step {current + 1} of {STEPS.length}: {STEPS[current]}
      </p>
    </nav>
  );
}
