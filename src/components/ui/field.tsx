import { useId } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[var(--radius-control)] border border-line bg-paper px-3.5 text-charcoal placeholder:text-ink-mute/70 transition-colors hover:border-sage-500 focus:border-forest-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 aria-[invalid=true]:border-danger";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (p: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

export function FieldShell({ label, hint, error, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-forest-950">
        {label}
        {required ? <span aria-hidden className="text-danger"> *</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? <p id={hintId} className="text-sm text-ink-mute">{hint}</p> : null}
      {error ? <p id={errId} role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string };

export function TextField({ label, hint, error, className, required, ...rest }: Common & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} required={required} className={cn(control, "h-12", className)} {...rest} />
      )}
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, className, required, ...rest }: Common & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} required={required} className={cn(control, "min-h-24 py-3", className)} {...rest} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  required,
  children,
  ...rest
}: Common & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} required={required} className={cn(control, "h-12", className)} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
