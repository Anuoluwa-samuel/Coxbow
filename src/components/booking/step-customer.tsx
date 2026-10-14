import Link from "next/link";
import { TextField } from "@/components/ui/field";
import type { StepProps } from "./types";

export function StepCustomer({ draft, errors, set }: StepProps) {
  return (
    <div className="space-y-6">
      <TextField label="Full name" required autoComplete="name" value={draft.customerName} error={errors.customerName} onChange={(e) => set("customerName", e.target.value)} />
      <TextField label="Phone number" required type="tel" inputMode="tel" autoComplete="tel" placeholder="0801 234 5678" value={draft.customerPhone} error={errors.customerPhone} hint="We use this to confirm your booking. WhatsApp-enabled numbers are best." onChange={(e) => set("customerPhone", e.target.value)} />
      <TextField label="Email (optional)" type="email" autoComplete="email" value={draft.customerEmail} error={errors.customerEmail} hint="For your confirmation and quotation." onChange={(e) => set("customerEmail", e.target.value)} />
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-forest-800" checked={draft.consent} aria-invalid={Boolean(errors.consent)} onChange={(e) => set("consent", e.target.checked)} />
          <span className="text-sm text-ink-soft">
            I agree that my details will be used to process this booking, as described in the{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-forest-800 underline">privacy policy</Link>, and I accept the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-forest-800 underline">terms</Link> and{" "}
            <Link href="/cancellation-policy" target="_blank" className="font-semibold text-forest-800 underline">cancellation policy</Link>.
          </span>
        </label>
        {errors.consent ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.consent}</p> : null}
      </div>
    </div>
  );
}
