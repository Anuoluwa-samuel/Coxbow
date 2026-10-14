import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { seedDemoCatalog } from "@/server/db/seed-catalog";
import { hashPassword } from "@/server/passwords";
import type { Role } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth-core";

/** Fixed "current time" injected into booking logic: Tue 2030-01-01 09:00 UTC. */
export const NOW = new Date("2030-01-01T09:00:00Z");
/** A Tuesday well past minimum notice. */
export const GOOD_DATE = "2030-01-15";

export async function resetDb(opts: { slotCapacity?: number } = {}) {
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const names = [...tables].map((t) => `"${t.tablename}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`));
  await seedDemoCatalog(db, { slotCapacity: opts.slotCapacity ?? 2 });
}

let counter = 0;
export async function makeUser(role: Role, password = "correct-horse-battery"): Promise<SessionUser & { password: string }> {
  const email = `${role}${++counter}@example.test`;
  const [u] = await db.insert(schema.users).values({ email, passwordHash: await hashPassword(password), fullName: `Test ${role}`, role }).returning();
  return { id: u.id, email, fullName: u.fullName, role, password };
}

export async function makeStaff(role: Role = "cleaner") {
  const user = await makeUser(role);
  const [profile] = await db.insert(schema.staffProfiles).values({ userId: user.id }).returning();
  return { user, staffId: profile.id };
}

let phoneCounter = 0;
export function bookingPayload(overrides: Record<string, unknown> = {}) {
  const n = String(++phoneCounter).padStart(7, "0");
  return {
    idempotencyKey: crypto.randomUUID(),
    serviceSlug: "residential-cleaning",
    propertyType: "apartment",
    bedrooms: 2, bathrooms: 2, sizeSqm: 80,
    addonSlugs: [], materials: "company_supplies",
    state: "Lagos", city: "Yaba", address: "12 Example Street, Yaba",
    date: GOOD_DATE, timeSlotId: "morning", frequency: "one_off",
    customerName: "Ada Obi", customerPhone: `0803${n}`, consent: true,
    ...overrides,
  };
}
