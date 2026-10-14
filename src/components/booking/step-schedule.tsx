import { Loader2 } from "lucide-react";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { Service, ServiceArea } from "@/lib/catalog-types";
import type { SlotInfo, StepProps } from "./types";

export function StepSchedule({
  draft, errors, set, areas, service, slots, slotsState, minDate,
}: StepProps & {
  areas: ServiceArea[];
  service?: Service;
  slots: SlotInfo[];
  slotsState: "idle" | "loading" | "error" | "ready";
  minDate: string;
}) {
  const states = [...new Set(areas.map((a) => a.state))];
  const cities = areas.filter((a) => a.state === draft.state);
  const hoods = areas.find((a) => a.state === draft.state && a.city === draft.city)?.neighbourhoods ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="State" required value={draft.state} error={errors.state} onChange={(e) => { set("state", e.target.value); set("city", ""); set("neighbourhood", ""); }}>
          <option value="">Select…</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        <SelectField label="City / area" required value={draft.city} error={errors.city} disabled={!draft.state} onChange={(e) => { set("city", e.target.value); set("neighbourhood", ""); }}>
          <option value="">Select…</option>
          {cities.map((c) => <option key={c.city}>{c.city}</option>)}
        </SelectField>
      </div>
      {hoods.length ? (
        <SelectField label="Neighbourhood" required value={draft.neighbourhood} error={errors.neighbourhood} onChange={(e) => set("neighbourhood", e.target.value)}>
          <option value="">Select…</option>
          {hoods.map((h) => <option key={h}>{h}</option>)}
        </SelectField>
      ) : null}
      <TextField label="Service address" required value={draft.address} error={errors.address} autoComplete="street-address" onChange={(e) => set("address", e.target.value)} />
      <TextArea label="Access instructions" value={draft.accessInstructions} maxLength={500} hint="Gate codes, security desk, parking, who to call on arrival." onChange={(e) => set("accessInstructions", e.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Preferred date" type="date" required min={minDate} value={draft.date} error={errors.date} onChange={(e) => { set("date", e.target.value); set("timeSlotId", ""); }} hint={service ? `Minimum ${service.minNoticeHours} hours notice. Dates are in Lagos time.` : undefined} />
        {service?.fields.recurring ? (
          <SelectField label="Frequency" value={draft.frequency} onChange={(e) => set("frequency", e.target.value as typeof draft.frequency)}>
            <option value="one_off">One-off</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </SelectField>
        ) : null}
      </div>

      {draft.date ? (
        <fieldset aria-describedby="slots-status">
          <legend className="mb-3 text-sm font-semibold text-forest-950">Time slot <span aria-hidden className="text-danger">*</span></legend>
          <div id="slots-status" aria-live="polite">
            {slotsState === "loading" ? <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…</p> : null}
            {slotsState === "error" ? <p role="alert" className="text-sm font-medium text-danger">Could not check availability. Check your connection and choose the date again.</p> : null}
          </div>
          {slotsState === "ready" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {slots.map((s) => (
                <label key={s.id} className={cn(
                  "flex flex-col rounded-[var(--radius-control)] border px-4 py-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brass",
                  s.available ? "cursor-pointer bg-paper hover:border-sage-500" : "cursor-not-allowed bg-sand text-ink-mute line-through",
                  draft.timeSlotId === s.id ? "border-forest-700 bg-sage-100" : "border-line",
                )}>
                  <input type="radio" name="slot" className="sr-only" disabled={!s.available} checked={draft.timeSlotId === s.id} onChange={() => set("timeSlotId", s.id)} />
                  <span className="font-semibold">{s.label}</span>
                  {!s.available ? <span className="no-underline">{s.reason ?? "Unavailable"}</span> : null}
                </label>
              ))}
            </div>
          ) : null}
          {errors.timeSlotId ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.timeSlotId}</p> : null}
        </fieldset>
      ) : null}
    </div>
  );
}
