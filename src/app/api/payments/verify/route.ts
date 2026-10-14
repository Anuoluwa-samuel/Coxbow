import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { bookings, payments } from "@/server/db/schema";
import { verifyAndApplyPayment } from "@/server/payments";
import { getPaystack } from "@/server/paystack";
import { AppError } from "@/server/errors";
import { safeEqual, sha256 } from "@/server/crypto";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";

const schema = z.object({ bookingReference: z.string().min(4).max(40), token: z.string().min(10).max(200), paymentReference: z.string().min(4).max(80) });

/** Called by the confirmation page after Paystack redirects back. The verification itself talks to Paystack. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "pay-verify", 20, 600);
    const p = schema.safeParse(await readJson(request));
    if (!p.success) throw new AppError("validation", "Invalid request");
    const [row] = await db
      .select({ hash: bookings.accessTokenHash })
      .from(payments).innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(payments.reference, p.data.paymentReference)).limit(1);
    const [owner] = await db.select({ hash: bookings.accessTokenHash }).from(bookings).where(eq(bookings.reference, p.data.bookingReference)).limit(1);
    if (!row || !owner || row.hash !== owner.hash || !safeEqual(sha256(p.data.token), owner.hash)) throw new AppError("not_found", "Payment not found");
    return json({ outcome: await verifyAndApplyPayment(db, getPaystack(), p.data.paymentReference) });
  } catch (e) {
    return errorResponse(e);
  }
}
