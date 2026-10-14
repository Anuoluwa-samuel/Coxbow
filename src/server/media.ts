import { and, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { media, services } from "./db/schema";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { can } from "@/lib/permissions";
import type { SessionUser } from "./auth-core";

type Actor = Pick<SessionUser, "id" | "role">;
export const MAX_IMAGE_BYTES = 1_500_000;
export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Identifies an image by its leading bytes, never by the filename or the browser-supplied type.
 * SVG is deliberately NOT accepted: it can carry scripts.
 */
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function setServiceImage(db: Db, actor: Actor, serviceSlug: string, bytes: Uint8Array, alt: string) {
  if (!can(actor.role, "services.write")) throw new AppError("forbidden", "You do not have permission to do that");
  if (bytes.length === 0) throw new AppError("validation", "Choose an image file");
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError("validation", `Image is too large. Keep it under ${(MAX_IMAGE_BYTES / 1_000_000).toFixed(1)} MB (about 1600 px wide is plenty).`);
  const type = sniffImageType(bytes);
  if (!type) throw new AppError("validation", "Upload a JPEG, PNG or WebP image.");
  const cleanAlt = alt.trim().slice(0, 200);
  return db.transaction(async (tx) => {
    const [svc] = await tx.select({ id: services.id, imageId: services.imageId }).from(services).where(eq(services.slug, serviceSlug)).for("update").limit(1);
    if (!svc) throw new AppError("not_found", "Service not found");
    const [m] = await tx.insert(media).values({ contentType: type, byteSize: bytes.length, bytes: Buffer.from(bytes), alt: cleanAlt, createdBy: actor.id }).returning({ id: media.id });
    await tx.update(services).set({ imageId: m.id, updatedAt: new Date() }).where(eq(services.id, svc.id));
    if (svc.imageId) await tx.delete(media).where(eq(media.id, svc.imageId)); // replaced: do not keep orphaned bytes
    await writeAudit(tx, actor.id, "service.image_set", "service", svc.id, { mediaId: m.id, bytes: bytes.length, type });
    return m.id;
  });
}

export async function removeServiceImage(db: Db, actor: Actor, serviceSlug: string) {
  if (!can(actor.role, "services.write")) throw new AppError("forbidden", "You do not have permission to do that");
  await db.transaction(async (tx) => {
    const [svc] = await tx.select({ id: services.id, imageId: services.imageId }).from(services).where(eq(services.slug, serviceSlug)).for("update").limit(1);
    if (!svc) throw new AppError("not_found", "Service not found");
    if (!svc.imageId) return;
    await tx.update(services).set({ imageId: null, updatedAt: new Date() }).where(eq(services.id, svc.id));
    await tx.delete(media).where(eq(media.id, svc.imageId));
    await writeAudit(tx, actor.id, "service.image_remove", "service", svc.id);
  });
}

/** Only images attached to an ENABLED service are public; everything else 404s. */
export async function getPublicImage(db: Db, id: string) {
  const [row] = await db.select({ type: media.contentType, bytes: media.bytes }).from(media)
    .innerJoin(services, and(eq(services.imageId, media.id), eq(services.enabled, true))).where(eq(media.id, id)).limit(1);
  return row ?? null;
}
