import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

/**
 * Minimal Paystack client covering only what we use (documented endpoints):
 *  POST {base}/transaction/initialize   body: email, amount (kobo), reference, callback_url
 *  GET  {base}/transaction/verify/:reference
 * Auth: "Authorization: Bearer <secret key>". Webhook signature: HMAC-SHA512 of the raw body
 * with the secret key, sent in the "x-paystack-signature" header.
 */
export interface PaystackVerifyData {
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amount: number; // kobo
  currency: string;
  id?: number;
}

export interface PaystackClient {
  initialize(input: { email: string; amountKobo: number; reference: string; callbackUrl: string }): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<PaystackVerifyData>;
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function getPaystack(): PaystackClient {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new AppError("conflict", "Online payment is not configured yet. Please contact us to arrange payment.");
  const base = process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co";
  const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  return {
    async initialize({ email, amountKobo, reference, callbackUrl }) {
      const res = await fetch(`${base}/transaction/initialize`, {
        method: "POST", headers, body: JSON.stringify({ email, amount: amountKobo, reference, callback_url: callbackUrl, currency: "NGN" }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.status || !body?.data?.authorization_url) throw new AppError("conflict", "The payment provider could not start the payment. Please try again.");
      return { authorizationUrl: body.data.authorization_url as string };
    },
    async verify(reference) {
      const res = await fetch(`${base}/transaction/verify/${encodeURIComponent(reference)}`, { headers, signal: AbortSignal.timeout(15_000) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data) throw new AppError("conflict", "Could not verify the payment with the provider.");
      return body.data as PaystackVerifyData;
    },
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = process.env.PAYSTACK_SECRET_KEY): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
