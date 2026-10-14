import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db/client";
import { fetchCategories, fetchService, fetchServiceAreas, fetchServices, fetchTimeSlots } from "./catalog-db";
import type { Service, ServiceArea, ServiceCategory, TimeSlot } from "@/lib/catalog-types";

/**
 * Cached catalogue reads for public pages. Entries are tagged "catalog"; any admin edit to
 * services, add-ons, areas or time slots must call revalidateTag("catalog", "max").
 * Uncached queries (used by booking logic, which must see live data) live in catalog-db.ts.
 */
export async function listCategories(): Promise<ServiceCategory[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return fetchCategories(db);
}

export async function listServices(opts: { popularOnly?: boolean } = {}): Promise<Service[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const all = await fetchServices(db);
  return opts.popularOnly ? all.filter((s) => s.popular) : all;
}

export async function getService(slug: string): Promise<Service | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return fetchService(db, slug);
}

export async function listServiceAreas(): Promise<ServiceArea[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return fetchServiceAreas(db);
}

export async function listTimeSlots(): Promise<TimeSlot[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const slots = await fetchTimeSlots(db);
  return slots.map(({ id, label, startHour, endHour }) => ({ id, label, startHour, endHour }));
}
