import { after } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { customerReschedule } from "@/server/customer-changes";
import { dispatchPending } from "@/server/notifications";
import { AppError } from "@/server/errors";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";
import { siteConfig } from "@/lib/site-config";

const schema = z.object({ token: z.string().min(10).max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slotId: z.string().min(1).max(40) });

export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[reference]/reschedule">) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "customer-reschedule", 10, 600);
    const { reference } = await ctx.params;
    const p = schema.safeParse(await readJson(request));
    if (!p.success) throw new AppError("validation", "Invalid request");
    const result = await customerReschedule(db, reference, p.data.token, p.data.date, p.data.slotId);
    after(() => dispatchPending(db, siteConfig.url).catch(() => undefined));
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
