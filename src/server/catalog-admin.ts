import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db/client";
import { businessSettings, serviceAddons, serviceCategories, services, timeSlots } from "./db/schema";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { can } from "@/lib/permissions";
import type { SessionUser } from "./auth-core";
import type { PricingConfig } from "@/lib/catalog-types";

type Actor = Pick<SessionUser, "id" | "role">;
const need = (a: Actor, p: "services.write" | "areas.write" | "settings.write") => {
  if (!can(a.role, p)) throw new AppError("forbidden", "You do not have permission to do that");
};

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export const serviceFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(5).max(300),
  description: z.string().trim().min(10).max(4000),
  idealFor: z.string().max(2000).transform(lines),
  includes: z.string().max(4000).transform(lines),
  excludes: z.string().max(4000).transform(lines),
  extraCharges: z.string().max(2000).transform(lines),
  pricingNote: z.string().trim().max(300),
  pricingModel: z.enum(["fixed", "by_size", "base_plus_addons", "inspection", "corporate_quote"]),
  baseNaira: z.string().trim().optional(),
  /** One tier per line: "<max sqm>: <naira>", e.g. "60: 25000" */
  tiers: z.string().max(2000).optional(),
  minNoticeHours: z.coerce.number().int().min(0).max(720),
  durationMinutes: z.coerce.number().int().min(15).max(1440),
  enabled: z.boolean(),
  popular: z.boolean(),
});

export function buildPricingConfig(model: z.infer<typeof serviceFormSchema>["pricingModel"], baseNaira?: string, tiers?: string): PricingConfig {
  const koboOf = (v: string) => Math.round(Number(v.replace(/[, ₦]/g, "")) * 100);
  if (model === "inspection" || model === "corporate_quote") return { model, currency: "NGN" };
  if (model === "by_size") {
    const parsed = lines(tiers ?? "").map((l) => {
      const [sqm, price] = l.split(":");
      return { maxSqm: Number(sqm), priceKobo: koboOf(price ?? "") };
    });
    if (!parsed.length || parsed.some((t) => !Number.isInteger(t.maxSqm) || t.maxSqm <= 0 || !Number.isSafeInteger(t.priceKobo) || t.priceKobo <= 0)) {
      throw new AppError("validation", "Enter size tiers as 'max square metres: price', one per line", { tiers: ["Invalid tiers"] });
    }
    return { model, currency: "NGN", sizeTiers: parsed.sort((a, b) => a.maxSqm - b.maxSqm) };
  }
  const base = koboOf(baseNaira ?? "");
  if (!Number.isSafeInteger(base) || base <= 0) throw new AppError("validation", "Enter a base price", { baseNaira: ["Required"] });
  return { model, currency: "NGN", baseKobo: base };
}

export async function updateService(db: Db, actor: Actor, slug: string, raw: unknown) {
  need(actor, "services.write");
  const p = serviceFormSchema.safeParse(raw);
  if (!p.success) throw new AppError("validation", "Check the highlighted fields", Object.fromEntries(p.error.issues.map((i) => [i.path.join("."), [i.message]])));
  const v = p.data;
  const pricing = buildPricingConfig(v.pricingModel, v.baseNaira, v.tiers);
  if (v.enabled && v.includes.length === 0) throw new AppError("validation", "List what is included before enabling this service", { includes: ["Required to enable"] });
  const [row] = await db.update(services).set({
    name: v.name, summary: v.summary, description: v.description, idealFor: v.idealFor, includes: v.includes, excludes: v.excludes,
    extraCharges: v.extraCharges, pricingNote: v.pricingNote, pricingModel: v.pricingModel, pricingConfig: pricing,
    minNoticeHours: v.minNoticeHours, durationMinutes: v.durationMinutes, enabled: v.enabled, popular: v.popular, updatedAt: new Date(),
  }).where(eq(services.slug, slug)).returning({ id: services.id });
  if (!row) throw new AppError("not_found", "Service not found");
  await writeAudit(db, actor.id, "service.update", "service", row.id, { slug, enabled: v.enabled, pricingModel: v.pricingModel });
}

export async function createService(db: Db, actor: Actor, input: { name: string; slug: string; categorySlug: string }) {
  need(actor, "services.write");
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new AppError("validation", "Slug may contain lowercase letters, numbers and hyphens", { slug: ["Invalid"] });
  if (input.name.trim().length < 2) throw new AppError("validation", "Enter a name", { name: ["Required"] });
  const [cat] = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.slug, input.categorySlug)).limit(1);
  if (!cat) throw new AppError("validation", "Choose a category", { categorySlug: ["Invalid"] });
  const [exists] = await db.select({ id: services.id }).from(services).where(eq(services.slug, slug)).limit(1);
  if (exists) throw new AppError("conflict", "A service with that slug already exists");
  const [row] = await db.insert(services).values({
    categoryId: cat.id, slug, name: input.name.trim(), summary: "Summary to be written", description: "Description to be written.",
    fields: { rooms: false, sizeSqm: false, recurring: false, materials: false }, pricingModel: "inspection", pricingConfig: { model: "inspection", currency: "NGN" },
    enabled: false, // new services stay hidden until an admin completes and enables them
  }).returning({ id: services.id });
  await writeAudit(db, actor.id, "service.create", "service", row.id, { slug });
  return slug;
}

export async function upsertAddon(db: Db, actor: Actor, serviceSlug: string, a: { slug: string; name: string; priceKobo: number; enabled: boolean }) {
  need(actor, "services.write");
  const slug = a.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || a.name.trim().length < 2) throw new AppError("validation", "Enter a valid name and slug");
  if (!Number.isSafeInteger(a.priceKobo) || a.priceKobo < 0) throw new AppError("validation", "Enter a valid price", { price: ["Invalid"] });
  const [svc] = await db.select({ id: services.id }).from(services).where(eq(services.slug, serviceSlug)).limit(1);
  if (!svc) throw new AppError("not_found", "Service not found");
  await db.insert(serviceAddons).values({ serviceId: svc.id, slug, name: a.name.trim(), priceKobo: a.priceKobo, enabled: a.enabled })
    .onConflictDoUpdate({ target: [serviceAddons.serviceId, serviceAddons.slug], set: { name: a.name.trim(), priceKobo: a.priceKobo, enabled: a.enabled } });
  await writeAudit(db, actor.id, "addon.upsert", "service", svc.id, { addon: slug, priceKobo: a.priceKobo, enabled: a.enabled });
}

export async function upsertArea(db: Db, actor: Actor, a: { state: string; city: string; neighbourhoods: string[]; enabled: boolean }) {
  need(actor, "areas.write");
  const state = a.state.trim(), city = a.city.trim();
  if (!state || !city) throw new AppError("validation", "State and city are required");
  await db.execute(sql`insert into service_areas (state, city, neighbourhoods, enabled)
    values (${state}, ${city}, ${JSON.stringify(a.neighbourhoods)}::jsonb, ${a.enabled})
    on conflict (lower(state), lower(city)) do update set neighbourhoods = excluded.neighbourhoods, enabled = excluded.enabled`);
  await writeAudit(db, actor.id, "area.upsert", "service_area", null, { state, city, enabled: a.enabled, neighbourhoods: a.neighbourhoods.length });
}

export async function updateTimeSlot(db: Db, actor: Actor, id: string, v: { capacity: number; enabled: boolean }) {
  need(actor, "settings.write");
  if (!Number.isInteger(v.capacity) || v.capacity < 1 || v.capacity > 100) throw new AppError("validation", "Capacity must be between 1 and 100");
  const r = await db.update(timeSlots).set({ capacity: v.capacity, enabled: v.enabled }).where(eq(timeSlots.id, id)).returning({ id: timeSlots.id });
  if (!r.length) throw new AppError("not_found", "Time slot not found");
  await writeAudit(db, actor.id, "timeslot.update", "time_slot", id, v);
}

export async function updateBookingSettings(db: Db, actor: Actor, v: { operatingDays: number[]; maxAdvanceDays: number }) {
  need(actor, "settings.write");
  const days = [...new Set(v.operatingDays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) throw new AppError("validation", "Choose at least one operating day");
  if (!Number.isInteger(v.maxAdvanceDays) || v.maxAdvanceDays < 1 || v.maxAdvanceDays > 365) throw new AppError("validation", "Advance booking window must be 1 to 365 days");
  await db.insert(businessSettings).values({ key: "booking", value: { operatingDays: days, maxAdvanceDays: v.maxAdvanceDays } })
    .onConflictDoUpdate({ target: businessSettings.key, set: { value: { operatingDays: days, maxAdvanceDays: v.maxAdvanceDays }, updatedAt: new Date() } });
  await writeAudit(db, actor.id, "settings.booking", "business_settings", "booking", { days, maxAdvanceDays: v.maxAdvanceDays });
}
