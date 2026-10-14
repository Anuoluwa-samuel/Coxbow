import { z } from "zod";
import { db } from "@/server/db/client";
import { submitReview } from "@/server/reviews";
import { AppError } from "@/server/errors";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";

const schema = z.object({ token: z.string().min(10).max(200), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });

export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[reference]/review">) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "review", 5, 3600);
    const { reference } = await ctx.params;
    const p = schema.safeParse(await readJson(request));
    if (!p.success) throw new AppError("validation", "Choose a rating from 1 to 5");
    await submitReview(db, reference, p.data.token, { rating: p.data.rating, comment: p.data.comment });
    return json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
