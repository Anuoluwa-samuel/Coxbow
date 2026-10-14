import { revalidateTag } from "next/cache";
import { db } from "@/server/db/client";
import { requirePermission } from "@/server/auth";
import { setServiceImage, MAX_IMAGE_BYTES } from "@/server/media";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json } from "@/server/http";

/** multipart/form-data: file, serviceSlug, alt. Requires services.write; validated by magic bytes, not filename. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requirePermission("services.write");
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 50_000) throw new AppError("validation", "Image is too large.");
    const form = await request.formData();
    const file = form.get("file");
    const slug = String(form.get("serviceSlug") ?? "");
    if (!(file instanceof File)) throw new AppError("validation", "Choose an image file");
    const id = await setServiceImage(db, actor, slug, new Uint8Array(await file.arrayBuffer()), String(form.get("alt") ?? ""));
    revalidateTag("catalog", "max");
    return json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
