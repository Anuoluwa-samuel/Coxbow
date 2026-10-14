"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/server/action";
import { cn } from "@/lib/utils";
import { useFlash } from "./flash";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Form bound to a server action. The result is handled in the submit handler (not an effect), so a
 * success banner still appears when the refreshed page no longer contains this form
 * (for example the "Approve" button once a booking is confirmed). Errors stay inline next to the form.
 */
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const flash = useFlash();

  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await action({ ok: true }, fd);
          if (result.ok) { if (result.message) flash({ ok: true, message: result.message }); }
          else setError(`${result.message ?? "Could not save."}${result.fieldErrors ? ` ${Object.values(result.fieldErrors).flat().join(" ")}` : ""}`);
        });
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {submitLabel}
        </Button>
        {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      </div>
    </form>
  );
}

export const inputCls = "h-10 w-full rounded-[var(--radius-control)] border border-line bg-paper px-3 text-sm focus:border-forest-700 focus:outline-none";
export const labelCls = "block text-xs font-semibold text-ink-soft mb-1";
