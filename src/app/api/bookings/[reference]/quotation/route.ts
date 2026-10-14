import { db } from "@/server/db/client";
import { respondToQuotation } from "@/server/workflow";
import { AppError } from "@/server/errors";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";
import { z } from "zod";

const bodySchema = z.object({ token: z.string().min(10).max(200), accept: z.boolean() });

export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[reference]/quotation">) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "quotation-response", 20, 600);
    const { reference } = await ctx.params;
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation", "Invalid request");
    return json(await respondToQuotation(db, reference, parsed.data.token, parsed.data.accept));
  } catch (e) {
    return errorResponse(e);
  }
}
