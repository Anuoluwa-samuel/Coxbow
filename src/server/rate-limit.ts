import { sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { rateLimits } from "./db/schema";

/**
 * Fixed-window limiter backed by Postgres so it works across serverless instances.
 * Returns ok=false once `limit` hits within the window are exceeded.
 */
export async function rateLimit(db: Db, key: string, limit: number, windowSeconds: number, now = new Date()) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), retryAfterSeconds: Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000) };
}

/** Housekeeping: drop windows older than a day. Call from a scheduled job. */
export async function purgeOldRateLimits(db: Db, now = new Date()) {
  await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < ${new Date(now.getTime() - 86_400_000)}`);
}
