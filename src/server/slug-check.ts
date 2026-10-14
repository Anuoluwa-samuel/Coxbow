import "server-only";
import { sql } from "./db/client";

const cache = new Map<string, { ok: boolean; exp: number }>();
const TTL_MS = 5_000;

/** Cheap existence check used by the proxy so unknown or disabled services return a real 404. */
export async function serviceSlugIsPublic(slug: string): Promise<boolean> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return false;
  const hit = cache.get(slug);
  const now = Date.now();
  if (hit && hit.exp > now) return hit.ok;
  const rows = await sql`select 1 from services where slug = ${slug} and enabled = true limit 1`;
  const ok = rows.length > 0;
  if (cache.size > 500) cache.clear();
  cache.set(slug, { ok, exp: now + TTL_MS });
  return ok;
}
