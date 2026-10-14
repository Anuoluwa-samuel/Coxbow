import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Single connection pool per server instance (survives dev hot reloads). */
const globalForDb = globalThis as unknown as { __coxbowSql?: ReturnType<typeof postgres> };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: process.env.DATABASE_PREPARE === "false" ? false : true,
    idle_timeout: 20,
  });
}

export const sql = (globalForDb.__coxbowSql ??= connect());
export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
