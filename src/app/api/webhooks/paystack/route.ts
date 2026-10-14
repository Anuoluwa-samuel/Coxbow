import { db } from "@/server/db/client";
import { handlePaystackWebhook } from "@/server/payments";
import { getPaystack } from "@/server/paystack";
import { AppError } from "@/server/errors";
import { errorResponse, json } from "@/server/http";

export async function POST(request: Request) {
  try {
    // Read the RAW body: the signature is computed over the exact bytes Paystack sent.
    const raw = await request.text();
    if (raw.length > 100_000) throw new AppError("validation", "Payload too large");
    const result = await handlePaystackWebhook(db, getPaystack(), raw, request.headers.get("x-paystack-signature"));
    return json({ received: true, duplicate: result.duplicate });
  } catch (e) {
    return errorResponse(e);
  }
}
