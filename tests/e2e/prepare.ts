/**
 * Resets the TEST database to a known state before the e2e run: migrations, demo catalogue,
 * and one user per role. Refuses to run unless the URL clearly points at a test database.
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as s from "../../src/server/db/schema";
import { seedDemoCatalog } from "../../src/server/db/seed-catalog";
import { hashPassword } from "../../src/server/passwords";
import { USERS } from "./constants";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/test/i.test(new URL(url).pathname)) throw new Error("Refusing to run: DATABASE_URL_TEST must point at a database whose name contains 'test'");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema: s });
  await migrate(db, { migrationsFolder: "./drizzle" });
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  await db.execute(sql.raw(`TRUNCATE TABLE ${[...tables].map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`));
  await seedDemoCatalog(db, { slotCapacity: 50 });
  for (const [role, u] of Object.entries(USERS)) {
    const [row] = await db.insert(s.users).values({ email: u.email, passwordHash: await hashPassword(u.password), fullName: u.name, role: role as "admin" }).returning({ id: s.users.id });
    if (role === "cleaner") await db.insert(s.staffProfiles).values({ userId: row.id });
  }
  await client.end();
  console.log("E2E database prepared.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
