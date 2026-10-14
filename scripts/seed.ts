/**
 * Seeds DEMONSTRATION data (see src/data/demo-catalog.ts) and the first admin account.
 * Safe to re-run: catalogue rows are upserted by slug; the admin is created only if missing.
 *
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  (password >= 12 chars)
 */
import { config } from "dotenv";
import { sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/server/db/schema";
import { seedDemoCatalog } from "../src/server/db/seed-catalog";
import { hashPassword } from "../src/server/passwords";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema: s });

  await seedDemoCatalog(db, { slotCapacity: 2 });

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const [existing] = await db.select({ id: s.users.id }).from(s.users).where(dsql`lower(${s.users.email}) = ${email}`);
    if (!existing) {
      await db.insert(s.users).values({ email, passwordHash: await hashPassword(password), fullName: "Administrator", role: "admin" });
      console.log(`Created admin user ${email}`);
    } else console.log("Admin user already exists; left unchanged.");
  } else console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set; skipped admin creation.");

  await client.end();
  console.log("Demo data seeded.");
}
main().catch((e) => { console.error(e); process.exit(1); });
