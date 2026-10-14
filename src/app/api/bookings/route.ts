import { db } from "@/server/db/client";
import { createBooking } from "@/server/bookings";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    // Abuse protection: a handful of submissions per IP per 10 minutes.
    await enforceRateLimit(request, "booking", 8, 600);
    const body = await readJson(request);
    const result = await createBooking(db, body);
    // The access token is returned once to the submitting browser, which redirects to the confirmation page.
    return json(result, { status: result.replayed ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
