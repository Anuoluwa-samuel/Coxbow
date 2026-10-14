import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db/client";
import { destroySession, SESSION_TTL_MS, userFromSessionToken, type SessionUser } from "./auth-core";
import { AppError } from "./errors";
import { can, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "cx_session";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSession() {
  const jar = await cookies();
  await destroySession(db, jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userFromSessionToken(db, token);
}

/** For pages and layouts: redirect to login when unauthenticated, 403 when not permitted. */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (!can(user.role, permission)) redirect("/admin/forbidden");
  return user;
}

/** For server actions and route handlers: throw typed errors instead of redirecting. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized", "Sign in required");
  if (!can(user.role, permission)) throw new AppError("forbidden", "You do not have permission to do that");
  return user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
