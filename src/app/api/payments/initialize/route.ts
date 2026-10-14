import { z } from "zod";
import { db } from "@/server/db/client";
import { initializePayment } from "@/server/payments";
import { getPaystack } from "@/server/paystack";
import { AppError } from "@/server/errors";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";
import { siteConfig } from "@/lib/site-config";

const schema = z.object({ reference: z.string().min(4).max(40), token: z.string().min(10).max(200) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "pay-init", 10, 600);
    const p = schema.safeParse(await readJson(request));
    if (!p.success) throw new AppError("validation", "Invalid request");
    return json(await initializePayment(db, getPaystack(), p.data.reference, p.data.token, siteConfig.url));
  } catch (e) {
    return errorResponse(e);
  }
}
