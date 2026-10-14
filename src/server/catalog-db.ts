import { asc, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { businessSettings, media, serviceAddons, serviceAreas, serviceCategories, services, timeSlots } from "./db/schema";
import type { Service, ServiceArea, ServiceCategory, TimeSlot } from "@/lib/catalog-types";

export interface BookingSettings {
  /** 0 = Sunday. */
  operatingDays: number[];
  maxAdvanceDays: number;
  /** Customers may cancel or reschedule themselves only this many hours before the start. */
  customerChangeNoticeHours: number;
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = { operatingDays: [1, 2, 3, 4, 5, 6], maxAdvanceDays: 60, customerChangeNoticeHours: 24 };

export type TimeSlotWithCapacity = TimeSlot & { capacity: number };

type ServiceRow = typeof services.$inferSelect;

function toService(row: ServiceRow, categorySlug: string, addons: (typeof serviceAddons.$inferSelect)[], alt?: string): Service {
  return {
    slug: row.slug, name: row.name, categorySlug, summary: row.summary, description: row.description,
    idealFor: row.idealFor, includes: row.includes, excludes: row.excludes, extraCharges: row.extraCharges,
    pricing: row.pricingConfig, pricingNote: row.pricingNote, fields: row.fields, propertyTypes: row.propertyTypes,
    addons: addons.filter((a) => a.serviceId === row.id).map((a) => ({ slug: a.slug, name: a.name, description: a.description ?? undefined, priceKobo: a.priceKobo, enabled: a.enabled })),
    faqs: row.faqs, relatedSlugs: row.relatedSlugs, enabled: row.enabled, popular: row.popular,
    minNoticeHours: row.minNoticeHours, durationMinutes: row.durationMinutes, sortOrder: row.sortOrder,
    imageId: row.imageId ?? undefined, imageAlt: row.imageId ? alt || row.name : undefined,
  };
}

export async function fetchServices(db: Db, opts: { includeDisabled?: boolean } = {}): Promise<Service[]> {
  const [rows, cats, addons, alts] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(serviceCategories),
    db.select().from(serviceAddons),
    db.select({ id: media.id, alt: media.alt }).from(media),
  ]);
  const catSlug = new Map(cats.map((c) => [c.id, c.slug]));
  const altOf = new Map(alts.map((m) => [m.id, m.alt]));
  return rows.filter((r) => opts.includeDisabled || r.enabled).map((r) => toService(r, catSlug.get(r.categoryId) ?? "", addons, r.imageId ? altOf.get(r.imageId) : undefined));
}

export async function fetchService(db: Db, slug: string, opts: { includeDisabled?: boolean } = {}): Promise<Service | null> {
  const [row] = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  if (!row || (!row.enabled && !opts.includeDisabled)) return null;
  const [[cat], addons, alt] = await Promise.all([
    db.select().from(serviceCategories).where(eq(serviceCategories.id, row.categoryId)).limit(1),
    db.select().from(serviceAddons).where(eq(serviceAddons.serviceId, row.id)),
    row.imageId ? db.select({ alt: media.alt }).from(media).where(eq(media.id, row.imageId)).limit(1) : Promise.resolve([]),
  ]);
  return toService(row, cat?.slug ?? "", addons, alt[0]?.alt);
}

export async function fetchCategories(db: Db): Promise<ServiceCategory[]> {
  const rows = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder));
  return rows.map((c) => ({ slug: c.slug, name: c.name, audience: c.audience as ServiceCategory["audience"], description: c.description, sortOrder: c.sortOrder }));
}

export async function fetchServiceAreas(db: Db, opts: { includeDisabled?: boolean } = {}): Promise<ServiceArea[]> {
  const rows = await db.select().from(serviceAreas).orderBy(asc(serviceAreas.state), asc(serviceAreas.city));
  return rows.filter((a) => opts.includeDisabled || a.enabled).map((a) => ({ state: a.state, city: a.city, neighbourhoods: a.neighbourhoods, enabled: a.enabled }));
}

export async function fetchTimeSlots(db: Db, opts: { includeDisabled?: boolean } = {}): Promise<(TimeSlotWithCapacity & { enabled: boolean })[]> {
  const rows = await db.select().from(timeSlots).orderBy(asc(timeSlots.sortOrder));
  return rows.filter((s) => opts.includeDisabled || s.enabled).map((s) => ({ id: s.id, label: s.label, startHour: s.startHour, endHour: s.endHour, capacity: s.capacity, enabled: s.enabled }));
}

export async function fetchBookingSettings(db: Db): Promise<BookingSettings> {
  const [row] = await db.select().from(businessSettings).where(eq(businessSettings.key, "booking")).limit(1);
  return { ...DEFAULT_BOOKING_SETTINGS, ...((row?.value as Partial<BookingSettings> | undefined) ?? {}) };
}
