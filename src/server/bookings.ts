import { eq, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { bookingItems, bookingStatusHistory, bookings, customers, notifications, quotations, services, timeSlots } from "./db/schema";
import { fetchBookingSettings, fetchService, fetchServiceAreas, fetchTimeSlots } from "./catalog-db";
import { countHeld, isValidDateString } from "./availability";
import { AppError } from "./errors";
import { hmac, newReference, safeEqual, sha256 } from "./crypto";
import { checkSlot, lagosInstant } from "@/lib/availability";
import { bookingInputSchema, type BookingInput } from "@/lib/booking-schema";
import { calculatePrice } from "@/lib/pricing";
import { isServiceable } from "@/lib/service-area";
import type { BookingStatus } from "@/lib/booking-status";

export interface CreateBookingResult {
  reference: string;
  accessToken: string;
  status: BookingStatus;
  requiresQuotation: boolean;
  estimateKobo: number | null;
  replayed: boolean;
}

/** The access token is derived from the booking id, so an idempotent retry can return the same link. */
export const accessTokenFor = (bookingId: string) => hmac(`booking-access:${bookingId}`);

function isUniqueViolation(e: unknown, constraintHint?: string): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const code = err.code ?? err.cause?.code;
  const name = err.constraint_name ?? err.cause?.constraint_name ?? "";
  return code === "23505" && (!constraintHint || name.includes(constraintHint));
}

/**
 * Creates a booking or quotation request. Everything that matters is decided here on the server:
 * price, serviceability, slot capacity, and status. Nothing from the browser is trusted beyond the
 * customer's own choices, which are validated against the catalogue.
 */
export async function createBooking(db: Db, raw: unknown, now = new Date()): Promise<CreateBookingResult> {
  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".") || "form"] ??= []).push(issue.message);
    throw new AppError("validation", "Some details are invalid", fieldErrors);
  }
  const input: BookingInput = parsed.data;

  // Idempotent replay: same key returns the same booking, never a second one.
  const existing = await findByIdempotencyKey(db, input.idempotencyKey);
  if (existing) return existing;

  const service = await fetchService(db, input.serviceSlug);
  if (!service) throw new AppError("not_found", "That service is not available");
  if (!isValidDateString(input.date)) throw new AppError("validation", "Invalid date", { date: ["Choose a valid date"] });
  if (!service.propertyTypes.includes(input.propertyType)) throw new AppError("validation", "Property type not supported for this service", { propertyType: ["Not available for this service"] });
  if (service.fields.materials && !input.materials) throw new AppError("validation", "Choose who provides materials", { materials: ["Required"] });
  if (service.fields.rooms && (input.bedrooms === undefined || input.bathrooms === undefined)) throw new AppError("validation", "Enter bedrooms and bathrooms", { bedrooms: ["Required"] });
  if (!service.fields.recurring && input.frequency !== "one_off") throw new AppError("validation", "This service is not offered as a recurring service", { frequency: ["Not available"] });

  const [areas, slots, settings] = await Promise.all([fetchServiceAreas(db), fetchTimeSlots(db), fetchBookingSettings(db)]);
  if (!isServiceable(areas, { state: input.state, city: input.city, neighbourhood: input.neighbourhood })) {
    throw new AppError("not_serviceable", "We do not currently serve this location", { city: ["We do not currently serve this location"] });
  }
  const slot = slots.find((s) => s.id === input.timeSlotId);
  if (!slot) throw new AppError("validation", "Unknown time slot", { timeSlotId: ["Choose a valid time slot"] });

  let price;
  try {
    price = calculatePrice({ service, sizeSqm: input.sizeSqm, addonSlugs: input.addonSlugs });
  } catch {
    throw new AppError("validation", "Invalid add-on selection", { addonSlugs: ["Choose valid add-ons"] });
  }

  const startsAt = lagosInstant(input.date, slot.startHour);
  const endsAt = lagosInstant(input.date, slot.endHour);

  const bookingId = crypto.randomUUID();
  const accessToken = accessTokenFor(bookingId);

  try {
    return await db.transaction(async (tx) => {
      // Serialise concurrent requests for the same slot so capacity cannot be oversold.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`slot:${input.date}:${slot.id}`}, 0))`);
      const bookedCount = await countHeld(tx, input.date, slot.id);
      const check = checkSlot({ date: input.date, slot, now, minNoticeHours: service.minNoticeHours, operatingDays: settings.operatingDays, maxAdvanceDays: settings.maxAdvanceDays, bookedCount, capacity: slot.capacity });
      if (!check.ok) throw new AppError("slot_unavailable", "That time slot is no longer available", { timeSlotId: [check.reason] });

      const [serviceRow] = await tx.select({ id: services.id }).from(services).where(eq(services.slug, service.slug)).limit(1);

      const [customer] = await tx
        .insert(customers)
        .values({ fullName: input.customerName, phone: input.customerPhone, email: input.customerEmail ?? null })
        .onConflictDoUpdate({ target: customers.phone, set: { fullName: input.customerName, email: input.customerEmail ?? sql`${customers.email}`, updatedAt: now } })
        .returning({ id: customers.id });

      const requiresQuotation = price.kind === "quotation";
      const snapshot = {
        service: { slug: service.slug, name: service.name, includes: service.includes, excludes: service.excludes, extraCharges: service.extraCharges, pricing: service.pricing },
        pricing: price,
        capturedAt: now.toISOString(),
      };

      // Reference collisions are astronomically unlikely, but retry rather than fail the customer.
      let reference = newReference();
      for (let attempt = 0; ; attempt++) {
        try {
          await tx.execute(sql`savepoint ref_try`);
          await tx.insert(bookings).values({
            id: bookingId, reference, idempotencyKey: input.idempotencyKey, accessTokenHash: sha256(accessToken),
            customerId: customer.id, serviceId: serviceRow.id, status: "requested",
            propertyType: input.propertyType, bedrooms: input.bedrooms, bathrooms: input.bathrooms, sizeSqm: input.sizeSqm,
            materials: input.materials, instructions: input.instructions,
            state: input.state, city: input.city, neighbourhood: input.neighbourhood, address: input.address, accessInstructions: input.accessInstructions,
            scheduledDate: input.date, timeSlotId: slot.id, startsAt, endsAt, frequency: input.frequency,
            estimateKobo: price.kind === "estimate" ? price.totalKobo : null, requiresQuotation, scopeSnapshot: snapshot, consentAt: now,
          });
          await tx.execute(sql`release savepoint ref_try`);
          break;
        } catch (e) {
          await tx.execute(sql`rollback to savepoint ref_try`);
          if (isUniqueViolation(e, "reference") && attempt < 4) { reference = newReference(); continue; }
          throw e;
        }
      }

      if (price.kind === "estimate") {
        await tx.insert(bookingItems).values([
          { bookingId, kind: "base", name: service.name, priceKobo: price.baseKobo },
          ...price.addonLines.map((l) => ({ bookingId, kind: "addon", name: l.name, priceKobo: l.priceKobo })),
        ]);
      }
      await tx.insert(bookingStatusHistory).values({ bookingId, fromStatus: null, toStatus: "requested", note: "Submitted by customer" });
      if (input.customerEmail) {
        await tx.insert(notifications).values({ bookingId, channel: "email", recipient: input.customerEmail, template: "booking_received" });
      }

      return { reference, accessToken, status: "requested" as const, requiresQuotation, estimateKobo: price.kind === "estimate" ? price.totalKobo : null, replayed: false };
    });
  } catch (e) {
    // Two requests with the same idempotency key raced: return the winner.
    if (isUniqueViolation(e, "idempotency")) {
      const winner = await findByIdempotencyKey(db, input.idempotencyKey);
      if (winner) return winner;
    }
    throw e;
  }
}

async function findByIdempotencyKey(db: Db, key: string): Promise<CreateBookingResult | null> {
  const [b] = await db
    .select({ id: bookings.id, reference: bookings.reference, status: bookings.status, requiresQuotation: bookings.requiresQuotation, estimateKobo: bookings.estimateKobo })
    .from(bookings)
    .where(eq(bookings.idempotencyKey, key))
    .limit(1);
  if (!b) return null;
  return { reference: b.reference, accessToken: accessTokenFor(b.id), status: b.status, requiresQuotation: b.requiresQuotation, estimateKobo: b.estimateKobo, replayed: true };
}

export interface CustomerBookingView {
  reference: string;
  status: BookingStatus;
  serviceName: string;
  scheduledDate: string;
  timeSlotLabel: string;
  address: string;
  city: string;
  requiresQuotation: boolean;
  estimateKobo: number | null;
  finalKobo: number | null;
  currency: string;
  items: { name: string; priceKobo: number }[];
  quotation: { id: string; version: number; amountKobo: number; notes: string | null; status: string; validUntil: Date | null } | null;
  customerName: string;
  createdAt: Date;
}

/**
 * Customer-facing lookup. Requires BOTH the reference and the secret token from the confirmation link.
 * A wrong token is indistinguishable from a missing booking, so references cannot be enumerated.
 * Internal notes, staff details and other customers' data are never included.
 */
export async function getBookingForCustomer(db: Db, reference: string, token: string | undefined): Promise<CustomerBookingView | null> {
  if (!token) return null;
  const [b] = await db
    .select({ b: bookings, serviceName: services.name, slotLabel: timeSlots.label, customerName: customers.fullName })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(timeSlots, eq(timeSlots.id, bookings.timeSlotId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(eq(bookings.reference, reference))
    .limit(1);
  if (!b || !safeEqual(sha256(token), b.b.accessTokenHash)) return null;

  const [items, qs] = await Promise.all([
    db.select({ name: bookingItems.name, priceKobo: bookingItems.priceKobo }).from(bookingItems).where(eq(bookingItems.bookingId, b.b.id)),
    db.select().from(quotations).where(eq(quotations.bookingId, b.b.id)),
  ]);
  const live = qs.filter((q) => q.status === "sent" || q.status === "accepted").sort((a, c) => c.version - a.version)[0];

  return {
    reference: b.b.reference, status: b.b.status, serviceName: b.serviceName, scheduledDate: b.b.scheduledDate, timeSlotLabel: b.slotLabel,
    address: b.b.address, city: b.b.city, requiresQuotation: b.b.requiresQuotation, estimateKobo: b.b.estimateKobo, finalKobo: b.b.finalKobo,
    currency: b.b.currency, items, customerName: b.customerName, createdAt: b.b.createdAt,
    quotation: live ? { id: live.id, version: live.version, amountKobo: live.amountKobo, notes: live.notes, status: live.status, validUntil: live.validUntil } : null,
  };
}
