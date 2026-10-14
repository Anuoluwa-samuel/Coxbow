import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/money";
import type { Service } from "@/lib/catalog-types";
import type { StepProps } from "./types";

export function StepService({ draft, errors, set, services, service }: StepProps & { services: Service[]; service?: Service }) {
  const toggleAddon = (slug: string) =>
    set("addonSlugs", draft.addonSlugs.includes(slug) ? draft.addonSlugs.filter((s) => s !== slug) : [...draft.addonSlugs, slug]);

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-forest-950">Which service do you need?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <label
              key={s.slug}
              className={cn(
                "flex cursor-pointer flex-col rounded-[var(--radius-control)] border bg-paper p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brass",
                draft.serviceSlug === s.slug ? "border-forest-700 bg-sage-100" : "border-line hover:border-sage-500",
              )}
            >
              <input type="radio" name="service" value={s.slug} checked={draft.serviceSlug === s.slug} onChange={() => { set("serviceSlug", s.slug); set("addonSlugs", []); }} className="sr-only" />
              <span className="font-semibold text-forest-950">{s.name}</span>
              <span className="mt-1 text-sm text-ink-soft">{s.summary}</span>
            </label>
          ))}
        </div>
        {errors.serviceSlug ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.serviceSlug}</p> : null}
      </fieldset>

      {service ? (
        <div className="space-y-6">
          <SelectField label="Property type" required value={draft.propertyType} error={errors.propertyType} onChange={(e) => set("propertyType", e.target.value as typeof draft.propertyType)}>
            <option value="">Select…</option>
            {service.propertyTypes.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </SelectField>

          {service.fields.rooms ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Bedrooms" type="number" inputMode="numeric" min={0} max={30} required value={draft.bedrooms} error={errors.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
              <TextField label="Bathrooms" type="number" inputMode="numeric" min={0} max={30} required value={draft.bathrooms} error={errors.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />
            </div>
          ) : null}

          {service.fields.sizeSqm ? (
            <TextField label="Approximate size (square metres)" type="number" inputMode="numeric" min={1} value={draft.sizeSqm} error={errors.sizeSqm} hint="Used for pricing. If you are unsure, leave it blank and we will quote after review." onChange={(e) => set("sizeSqm", e.target.value)} />
          ) : null}

          {service.addons.some((a) => a.enabled) ? (
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-forest-950">Add-ons (optional)</legend>
              <div className="space-y-2">
                {service.addons.filter((a) => a.enabled).map((a) => (
                  <label key={a.slug} className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-paper px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brass">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" className="size-5 accent-forest-800" checked={draft.addonSlugs.includes(a.slug)} onChange={() => toggleAddon(a.slug)} />
                      {a.name}
                    </span>
                    <span className="text-sm text-ink-soft">+{formatNaira(a.priceKobo)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {service.fields.materials ? (
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-forest-950">Cleaning materials <span aria-hidden className="text-danger">*</span></legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([["company_supplies", "We bring materials"], ["customer_supplies", "I will provide materials"]] as const).map(([v, label]) => (
                  <label key={v} className={cn("flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border bg-paper px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brass", draft.materials === v ? "border-forest-700 bg-sage-100" : "border-line")}>
                    <input type="radio" name="materials" className="size-5 accent-forest-800" checked={draft.materials === v} onChange={() => set("materials", v)} />
                    {label}
                  </label>
                ))}
              </div>
              {errors.materials ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.materials}</p> : null}
            </fieldset>
          ) : null}

          <TextArea label="Anything we should know?" value={draft.instructions} maxLength={1000} hint="Pets, fragile items, areas to prioritise." onChange={(e) => set("instructions", e.target.value)} />
        </div>
      ) : null}
    </div>
  );
}
