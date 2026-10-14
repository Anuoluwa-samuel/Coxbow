import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET must be set and at least 32 characters");
  return s;
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const hmac = (v: string) => createHmac("sha256", appSecret()).update(v).digest("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Booking reference: unambiguous alphabet (no 0/O/1/I), 8 chars => ~40 bits. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newReference(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `CXB-${out}`;
}

/** Privacy-conscious rate-limit key: a keyed hash, never the raw IP. */
export function anonymise(v: string): string {
  return hmac(`ip:${v}`).slice(0, 22);
}
