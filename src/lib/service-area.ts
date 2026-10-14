import type { ServiceArea } from "./catalog-types";

const norm = (s: string) => s.trim().toLowerCase();

export interface AreaQuery {
  state: string;
  city: string;
  neighbourhood?: string;
}

/**
 * A request is covered when an enabled area matches state and city, and either the
 * area covers the whole city (no neighbourhoods listed) or lists the neighbourhood.
 */
export function isServiceable(areas: ServiceArea[], q: AreaQuery): boolean {
  return areas.some((a) => {
    if (!a.enabled) return false;
    if (norm(a.state) !== norm(q.state) || norm(a.city) !== norm(q.city)) return false;
    if (a.neighbourhoods.length === 0) return true;
    if (!q.neighbourhood) return false;
    return a.neighbourhoods.some((n) => norm(n) === norm(q.neighbourhood!));
  });
}
