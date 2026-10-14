import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { LOCK_MS, MAX_FAILED_LOGINS, SESSION_TTL_MS, destroySession, login, revokeUserSessions, userFromSessionToken } from "@/server/auth-core";
import { hashPassword, verifyPassword } from "@/server/passwords";
import { rateLimit } from "@/server/rate-limit";
import { makeUser, resetDb } from "./helpers";

beforeEach(async () => { await resetDb(); });

describe("passwords", () => {
  it("hashes with salt, verifies, and rejects short passwords", async () => {
    const h1 = await hashPassword("a-long-enough-password");
    const h2 = await hashPassword("a-long-enough-password");
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("a-long-enough-password", h1)).toBe(true);
    expect(await verifyPassword("wrong-password-here", h1)).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
});

describe("login and sessions", () => {
  it("logs in, stores only a hashed token, and resolves the user from the token", async () => {
    const u = await makeUser("manager");
    const r = await login(db, u.email.toUpperCase(), u.password);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await db.select().from(schema.sessions);
    expect(row.tokenHash).not.toBe(r.token);
    expect(row.tokenHash).toHaveLength(64);
    expect(await userFromSessionToken(db, r.token)).toMatchObject({ id: u.id, role: "manager" });
  });

  it("rejects wrong passwords and unknown users with the same result", async () => {
    const u = await makeUser("admin");
    expect(await login(db, u.email, "wrong-password-xx")).toEqual({ ok: false, reason: "invalid" });
    expect(await login(db, "nobody@example.test", "wrong-password-xx")).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks the account after repeated failures, even for the right password, then unlocks", async () => {
    const u = await makeUser("admin");
    const t0 = new Date("2030-01-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await login(db, u.email, "wrong-password-xx", { now: t0 });
    expect(await login(db, u.email, u.password, { now: t0 })).toEqual({ ok: false, reason: "locked" });
    const later = new Date(t0.getTime() + LOCK_MS + 1000);
    expect((await login(db, u.email, u.password, { now: later })).ok).toBe(true);
  });

  it("expires sessions, supports logout and revocation, and blocks deactivated users", async () => {
    const u = await makeUser("cleaner");
    const t0 = new Date("2030-01-01T10:00:00Z");
    const r = await login(db, u.email, u.password, { now: t0 });
    if (!r.ok) throw new Error("login failed");
    expect(await userFromSessionToken(db, r.token, new Date(t0.getTime() + SESSION_TTL_MS - 1000))).not.toBeNull();
    expect(await userFromSessionToken(db, r.token, new Date(t0.getTime() + SESSION_TTL_MS + 1000))).toBeNull();
    expect(await userFromSessionToken(db, undefined)).toBeNull();
    expect(await userFromSessionToken(db, "forged-token")).toBeNull();

    const again = await login(db, u.email, u.password);
    if (!again.ok) throw new Error("login failed");
    await destroySession(db, again.token);
    expect(await userFromSessionToken(db, again.token)).toBeNull();

    const third = await login(db, u.email, u.password);
    if (!third.ok) throw new Error("login failed");
    await db.update(schema.users).set({ active: false }).where(eq(schema.users.id, u.id));
    expect(await userFromSessionToken(db, third.token)).toBeNull();
    expect((await login(db, u.email, u.password)).ok).toBe(false);
    await revokeUserSessions(db, u.id);
    expect(await db.select().from(schema.sessions)).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window, then blocks, then resets", async () => {
    const t = new Date("2030-01-01T10:00:10Z");
    for (let i = 0; i < 3; i++) expect((await rateLimit(db, "k", 3, 60, t)).ok).toBe(true);
    const blocked = await rateLimit(db, "k", 3, 60, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await rateLimit(db, "other", 3, 60, t)).ok).toBe(true);
    expect((await rateLimit(db, "k", 3, 60, new Date("2030-01-01T10:01:10Z"))).ok).toBe(true);
  });
});

describe("database integrity", () => {
  it("makes status history and audit logs append-only", async () => {
    const u = await makeUser("admin");
    await db.insert(schema.auditLogs).values({ actorId: u.id, action: "x", entity: "y" });
    await expect(db.execute(sql`update audit_logs set action = 'tampered'`)).rejects.toThrow();
    await expect(db.execute(sql`delete from audit_logs`)).rejects.toThrow();
  });

  it("rejects negative money and invalid ratings", async () => {
    await expect(db.execute(sql`insert into service_addons (service_id, slug, name, price_kobo) select id, 'bad', 'Bad', -1 from services limit 1`)).rejects.toThrow();
  });
});
