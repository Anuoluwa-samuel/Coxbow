import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { anonymise } from "./crypto";
import { db } from "./db/client";
import { rateLimit } from "./rate-limit";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

/** Maps typed errors to safe responses. Unknown errors are logged without payloads and shown generically. */
export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return json({ code: e.code, message: e.message, fieldErrors: e.fieldErrors }, { status: e.status });
  }
  console.error("Unhandled error:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
  return json({ code: "internal", message: "Something went wrong on our side. Please try again." }, { status: 500 });
}

/** Rejects browser requests that originate from another site. Non-browser clients (no Origin) pass. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (new URL(origin).host !== host) throw new AppError("forbidden", "Cross-origin request blocked");
}

export function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function enforceRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(db, `${bucket}:${anonymise(requestIp(request))}`, limit, windowSeconds);
  if (!r.ok) throw new AppError("rate_limited", `Too many requests. Try again in ${r.retryAfterSeconds} seconds.`);
}

/** Reads a JSON body with a hard size cap. */
export async function readJson(request: Request, maxBytes = 32_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("validation", "Expected JSON");
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("validation", "Request too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("validation", "Invalid JSON");
  }
}
