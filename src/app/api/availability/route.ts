import type { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { getSlotAvailability } from "@/server/availability";
import { enforceRateLimit, errorResponse, json } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, "availability", 60, 60);
    const service = request.nextUrl.searchParams.get("service") ?? "";
    const date = request.nextUrl.searchParams.get("date") ?? "";
    return json({ slots: await getSlotAvailability(db, service, date) });
  } catch (e) {
    return errorResponse(e);
  }
}
