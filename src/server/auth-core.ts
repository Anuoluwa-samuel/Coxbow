import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { sessions, users } from "./db/schema";
import { randomToken, sha256 } from "./crypto";
import { DUMMY_HASH, verifyPassword } from "./passwords";
import type { Role } from "@/lib/permissions";

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; user: SessionUser }
  | { ok: false; reason: "invalid" | "locked" };

/**
 * Verifies credentials with uniform timing and a lockout after repeated failures.
 * Callers must show one generic message for every failure reason.
 */
export async function login(db: Db, email: string, password: string, ctx: { userAgent?: string; now?: Date } = {}): Promise<LoginResult> {
  const now = ctx.now ?? new Date();
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`).limit(1);

  if (user?.lockedUntil && user.lockedUntil > now) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: "locked" };
  }
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !valid) {
    if (user) {
      const failed = user.failedLogins + 1;
      await db.update(users).set({ failedLogins: failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MS) : null }).where(eq(users.id, user.id));
    }
    return { ok: false, reason: "invalid" };
  }

  await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: now }).where(eq(users.id, user.id));
  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId: user.id, tokenHash: sha256(token), expiresAt, userAgent: ctx.userAgent?.slice(0, 300) });
  return { ok: true, token, expiresAt, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
}

export async function userFromSessionToken(db: Db, token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, active: users.active })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row || !row.active) return null;
  return { id: row.id, email: row.email, fullName: row.fullName, role: row.role };
}

export async function destroySession(db: Db, token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

/** Revoke every session for a user (password change, deactivation). */
export async function revokeUserSessions(db: Db, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
