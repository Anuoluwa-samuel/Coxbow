import { db } from "@/server/db/client";
import { getPublicImage } from "@/server/media";

/** Public service photos. ids are random UUIDs and replaced (not edited) on upload, so they can be cached forever. */
export async function GET(_req: Request, ctx: RouteContext<"/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const img = await getPublicImage(db, id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
