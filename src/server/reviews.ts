import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db/client";
import { bookings, customers, reviews, services } from "./db/schema";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { safeEqual, sha256 } from "./crypto";
import { can } from "@/lib/permissions";
import type { SessionUser } from "./auth-core";

type Actor = Pick<SessionUser, "id" | "role">;

const input = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

/** A customer reviews a COMPLETED job, once, via their private link. Reviews are hidden until staff approve them. */
export async function submitReview(db: Db, reference: string, token: string | undefined, raw: unknown) {
  const p = input.safeParse(raw);
  if (!p.success) throw new AppError("validation", "Choose a rating from 1 to 5", { rating: ["Invalid"] });
  if (!token) throw new AppError("not_found", "Booking not found");
  const [b] = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1);
  if (!b || !safeEqual(sha256(token), b.accessTokenHash)) throw new AppError("not_found", "Booking not found");
  if (b.status !== "completed") throw new AppError("conflict", "You can review a booking once the job is completed.");
  try {
    await db.insert(reviews).values({ bookingId: b.id, rating: p.data.rating, comment: p.data.comment || null, approved: false });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new AppError("conflict", "You have already reviewed this booking.");
    throw e;
  }
}

export async function listReviewsForModeration(db: Db) {
  return db.select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, approved: reviews.approved, createdAt: reviews.createdAt, reference: bookings.reference, bookingId: bookings.id, customer: customers.fullName, service: services.name })
    .from(reviews).innerJoin(bookings, eq(bookings.id, reviews.bookingId)).innerJoin(customers, eq(customers.id, bookings.customerId)).innerJoin(services, eq(services.id, bookings.serviceId))
    .orderBy(sql`${reviews.approved} asc`, desc(reviews.createdAt)).limit(200);
}

export async function setReviewApproved(db: Db, actor: Actor, reviewId: string, approved: boolean) {
  if (!can(actor.role, "reviews.moderate")) throw new AppError("forbidden", "You do not have permission to do that");
  const r = await db.update(reviews).set({ approved }).where(eq(reviews.id, reviewId)).returning({ id: reviews.id });
  if (!r.length) throw new AppError("not_found", "Review not found");
  await writeAudit(db, actor.id, approved ? "review.approve" : "review.hide", "review", reviewId);
}

/** Public: approved reviews only, with just the customer's first name. */
export async function listApprovedReviews(db: Db, opts: { serviceSlug?: string; limit?: number } = {}) {
  const rows = await db.select({ rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, customer: customers.fullName, service: services.name, slug: services.slug })
    .from(reviews).innerJoin(bookings, eq(bookings.id, reviews.bookingId)).innerJoin(customers, eq(customers.id, bookings.customerId)).innerJoin(services, eq(services.id, bookings.serviceId))
    .where(opts.serviceSlug ? sql`${reviews.approved} = true AND ${services.slug} = ${opts.serviceSlug}` : eq(reviews.approved, true))
    .orderBy(desc(reviews.createdAt)).limit(opts.limit ?? 6);
  return rows.map((r) => ({ rating: r.rating, comment: r.comment, service: r.service, slug: r.slug, firstName: r.customer.split(" ")[0], createdAt: r.createdAt }));
}
