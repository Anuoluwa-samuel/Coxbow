import type { Db, Tx } from "./db/client";
import { auditLogs } from "./db/schema";

/** Append-only (enforced by a DB trigger). Keep metadata free of secrets and bulk personal data. */
export async function writeAudit(
  db: Db | Tx,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({ actorId, action, entity, entityId, metadata: metadata ?? null });
}
