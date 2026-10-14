import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { demoCategories, demoServiceAreas, demoServices, demoTimeSlots } from "@/data/demo-catalog";
import type { Service, ServiceArea, ServiceCategory, TimeSlot } from "@/lib/catalog-types";

/**
 * Catalogue access layer. Pages and route handlers call these functions only.
 * Results are cached and tagged "catalog"; admin edits call revalidateTag("catalog").
 * Phase 3 swaps the implementation for database queries without touching callers.
 */
export async function listCategories(): Promise<ServiceCategory[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return demoCategories;
}

export async function listServices(opts: { popularOnly?: boolean } = {}): Promise<Service[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return demoServices
    .filter((s) => s.enabled && (!opts.popularOnly || s.popular))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getService(slug: string): Promise<Service | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return demoServices.find((s) => s.slug === slug && s.enabled) ?? null;
}

export async function listServiceAreas(): Promise<ServiceArea[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return demoServiceAreas.filter((a) => a.enabled);
}

export async function listTimeSlots(): Promise<TimeSlot[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return demoTimeSlots;
}
