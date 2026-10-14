import { sql as dsql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "./schema";
import { demoCategories, demoServiceAreas, demoServices, demoTimeSlots } from "@/data/demo-catalog";

/** Idempotent upsert of the DEMONSTRATION catalogue. Used by scripts/seed.ts and the test suite. */
export async function seedDemoCatalog(db: PostgresJsDatabase<typeof s>, opts: { slotCapacity?: number } = {}) {
  for (const [i, c] of demoCategories.entries()) {
    await db.insert(s.serviceCategories).values({ ...c, sortOrder: i }).onConflictDoUpdate({ target: s.serviceCategories.slug, set: { name: c.name, audience: c.audience, description: c.description, sortOrder: i } });
  }
  const cats = await db.select().from(s.serviceCategories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  for (const svc of demoServices) {
    const values = {
      categoryId: catId.get(svc.categorySlug)!, slug: svc.slug, name: svc.name, summary: svc.summary, description: svc.description,
      idealFor: svc.idealFor, includes: svc.includes, excludes: svc.excludes, extraCharges: svc.extraCharges, faqs: svc.faqs,
      relatedSlugs: svc.relatedSlugs, propertyTypes: svc.propertyTypes, fields: svc.fields, pricingModel: svc.pricing.model,
      pricingConfig: svc.pricing, pricingNote: svc.pricingNote, enabled: svc.enabled, popular: svc.popular,
      minNoticeHours: svc.minNoticeHours, durationMinutes: svc.durationMinutes, sortOrder: svc.sortOrder,
    };
    const [row] = await db.insert(s.services).values(values).onConflictDoUpdate({ target: s.services.slug, set: { ...values, updatedAt: new Date() } }).returning({ id: s.services.id });
    for (const a of svc.addons) {
      await db.insert(s.serviceAddons).values({ serviceId: row.id, slug: a.slug, name: a.name, priceKobo: a.priceKobo, enabled: a.enabled })
        .onConflictDoUpdate({ target: [s.serviceAddons.serviceId, s.serviceAddons.slug], set: { name: a.name, priceKobo: a.priceKobo, enabled: a.enabled } });
    }
  }
  for (const a of demoServiceAreas) {
    await db.execute(dsql`insert into service_areas (state, city, neighbourhoods, enabled)
      values (${a.state}, ${a.city}, ${JSON.stringify(a.neighbourhoods)}::jsonb, ${a.enabled})
      on conflict (lower(state), lower(city)) do update set neighbourhoods = excluded.neighbourhoods, enabled = excluded.enabled`);
  }
  for (const [i, t] of demoTimeSlots.entries()) {
    await db.insert(s.timeSlots).values({ ...t, capacity: opts.slotCapacity ?? 2, sortOrder: i }).onConflictDoUpdate({ target: s.timeSlots.id, set: { label: t.label, startHour: t.startHour, endHour: t.endHour, sortOrder: i } });
  }
  await db.insert(s.businessSettings).values({ key: "booking", value: { operatingDays: [1, 2, 3, 4, 5, 6], maxAdvanceDays: 60 } }).onConflictDoNothing();
}
