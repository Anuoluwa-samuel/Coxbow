import { after } from "next/server";
import { z } from "zod";
import { db } from "@/server/db/client";
import { customerCancel } from "@/server/customer-changes";
import { dispatchPending } from "@/server/notifications";
import { AppError } from "@/server/errors";
import { assertSameOrigin, enforceRateLimit, errorResponse, json, readJson } from "@/server/http";
import { siteConfig } from "@/lib/site-config";

const schema = z.object({ token: z.string().min(10).max(200), reason: z.string().max(300).optional() });

export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[reference]/cancel">) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "customer-cancel", 10, 600);
    const { reference } = await ctx.params;
    const p = schema.safeParse(await readJson(request));
    if (!p.success) throw new AppError("validation", "Invalid request");
    const result = await customerCancel(db, reference, p.data.token, p.data.reason);
    after(() => dispatchPending(db, siteConfig.url).catch(() => undefined));
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
