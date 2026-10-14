"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/action";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Form bound to a server action, with pending state and an accessible result message. */
export function ActionForm({
  action, submitLabel, children, className, variant = "primary", confirm,
}: {
  action: Action;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true } as ActionState);
  return (
    <form
      action={formAction}
      className={cn("space-y-3", className)}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {submitLabel}
        </Button>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={cn("text-sm font-medium", state.ok ? "text-forest-700" : "text-danger")}>
            {state.message}
            {!state.ok && state.fieldErrors ? ` ${Object.values(state.fieldErrors).flat().join(" ")}` : ""}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export const inputCls = "h-10 w-full rounded-[var(--radius-control)] border border-line bg-paper px-3 text-sm focus:border-forest-700 focus:outline-none";
export const labelCls = "block text-xs font-semibold text-ink-soft mb-1";
