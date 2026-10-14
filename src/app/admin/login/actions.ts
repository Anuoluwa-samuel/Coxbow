"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { login } from "@/server/auth-core";
import { clientIp, setSessionCookie } from "@/server/auth";
import { anonymise } from "@/server/crypto";
import { rateLimit } from "@/server/rate-limit";
import { headers } from "next/headers";
import type { ActionState } from "@/server/action";

const schema = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });
const GENERIC = "Incorrect email or password, or the account is temporarily locked.";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: GENERIC };

  // Throttle by IP and by account so a distributed guess still hits a ceiling.
  const ipKey = `login-ip:${anonymise(await clientIp())}`;
  const acctKey = `login-acct:${anonymise(parsed.data.email.toLowerCase())}`;
  const [a, b] = [await rateLimit(db, ipKey, 20, 600), await rateLimit(db, acctKey, 10, 600)];
  if (!a.ok || !b.ok) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };

  const result = await login(db, parsed.data.email, parsed.data.password, { userAgent: (await headers()).get("user-agent") ?? undefined });
  if (!result.ok) return { ok: false, message: GENERIC };

  await setSessionCookie(result.token, result.expiresAt);
  redirect(result.user.role === "cleaner" ? "/admin/jobs" : "/admin");
}
