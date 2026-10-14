import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/** Direct SQL access to the e2e database, for arranging and asserting state. */
export async function withDb<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL_TEST!, { max: 1 });
  try { return await fn(sql); } finally { await sql.end(); }
}
