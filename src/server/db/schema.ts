import { sql } from "drizzle-orm";
import {
  boolean, check, customType, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text,
  time, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import type { Faq, PricingConfig, ServiceFields, PropertyType } from "@/lib/catalog-types";

/**
 * Conventions
 * - UUID primary keys (non-guessable). Customer-facing lookups use a separate booking reference.
 * - Money is integer kobo (bigint-safe range for NGN) with an explicit currency column.
 * - All timestamps are timestamptz (UTC). Business dates/times are interpreted in Africa/Lagos.
 * - History is kept: cancellation and rescheduling change status/rows, never delete.
 */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum("user_role", ["admin", "manager", "cleaner"]);
export const bookingStatus = pgEnum("booking_status", [
  "requested", "quoted", "confirmed", "scheduled", "in_progress", "completed", "rejected", "cancelled",
]);
export const pricingModel = pgEnum("pricing_model", ["fixed", "by_size", "base_plus_addons", "inspection", "corporate_quote"]);
export const quotationStatus = pgEnum("quotation_status", ["draft", "sent", "accepted", "declined", "superseded", "expired"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "success", "failed", "refunded", "partially_refunded"]);
export const assignmentStatus = pgEnum("assignment_status", ["active", "released"]);
export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp", "sms"]);
export const notificationStatus = pgEnum("notification_status", ["queued", "sent", "failed", "skipped"]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

// ---------- Identity ----------

/** Staff-facing accounts (admin, manager, cleaner). Customers do not need accounts. */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: userRole("role").notNull(),
    active: boolean("active").notNull().default(true),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

/** Only a SHA-256 hash of the session token is stored; the raw token lives in the cookie. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(), // E.164, normalised
    email: text("email"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customers_phone_uq").on(t.phone), index("customers_email_idx").on(sql`lower(${t.email})`)],
);

// ---------- Catalogue ----------

export const serviceCategories = pgTable("service_categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  audience: text("audience").notNull().default("both"),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * Uploaded images (service photos). Stored in Postgres so the app needs no extra storage service.
 * Access goes through src/server/media.ts, which validates type and size. To move to object storage
 * later, keep this table as the metadata record and swap the byte storage behind that module.
 */
export const media = pgTable(
  "media",
  {
    id: id(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    bytes: bytea("bytes").notNull(),
    alt: text("alt").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    check("media_type_allowed", sql`${t.contentType} IN ('image/jpeg','image/png','image/webp')`),
    check("media_size_cap", sql`${t.byteSize} > 0 AND ${t.byteSize} <= 2097152`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    categoryId: uuid("category_id").notNull().references(() => serviceCategories.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    idealFor: jsonb("ideal_for").$type<string[]>().notNull().default([]),
    includes: jsonb("includes").$type<string[]>().notNull().default([]),
    excludes: jsonb("excludes").$type<string[]>().notNull().default([]),
    extraCharges: jsonb("extra_charges").$type<string[]>().notNull().default([]),
    faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
    relatedSlugs: jsonb("related_slugs").$type<string[]>().notNull().default([]),
    propertyTypes: jsonb("property_types").$type<PropertyType[]>().notNull().default([]),
    fields: jsonb("fields").$type<ServiceFields>().notNull(),
    pricingModel: pricingModel("pricing_model").notNull(),
    /** Validated PricingConfig (base amount, size tiers). Amounts are kobo. */
    pricingConfig: jsonb("pricing_config").$type<PricingConfig>().notNull(),
    pricingNote: text("pricing_note").notNull().default(""),
    enabled: boolean("enabled").notNull().default(false), // services are off until an admin enables them
    popular: boolean("popular").notNull().default(false),
    minNoticeHours: integer("min_notice_hours").notNull().default(24),
    durationMinutes: integer("duration_minutes").notNull().default(180),
    sortOrder: integer("sort_order").notNull().default(0),
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("services_notice_nonneg", sql`${t.minNoticeHours} >= 0`),
    check("services_duration_pos", sql`${t.durationMinutes} > 0`),
  ],
);

export const serviceAddons = pgTable(
  "service_addons",
  {
    id: id(),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    priceKobo: integer("price_kobo").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("service_addons_uq").on(t.serviceId, t.slug), check("addon_price_nonneg", sql`${t.priceKobo} >= 0`)],
);

export const serviceAreas = pgTable(
  "service_areas",
  {
    id: id(),
    state: text("state").notNull(),
    city: text("city").notNull(),
    /** Empty array = whole city covered. */
    neighbourhoods: jsonb("neighbourhoods").$type<string[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(false),
  },
  (t) => [uniqueIndex("service_areas_uq").on(sql`lower(${t.state})`, sql`lower(${t.city})`)],
);

export const timeSlots = pgTable(
  "time_slots",
  {
    id: text("id").primaryKey(), // stable slug, e.g. "morning"
    label: text("label").notNull(),
    startHour: smallint("start_hour").notNull(),
    endHour: smallint("end_hour").notNull(),
    /** Max concurrent jobs the business can run in this slot (e.g. number of crews). */
    capacity: integer("capacity").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [check("slot_hours_valid", sql`${t.startHour} >= 0 AND ${t.endHour} <= 24 AND ${t.startHour} < ${t.endHour}`), check("slot_capacity_pos", sql`${t.capacity} > 0`)],
);

/** Key/value business configuration: operating days, advance booking window, etc. */
export const businessSettings = pgTable("business_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ---------- Bookings ----------

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    /** Customer-facing reference, e.g. CXB-7K3QH9TW. Unique, not sequential. */
    reference: text("reference").notNull().unique(),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    /** SHA-256 of the secret in the customer's confirmation link. */
    accessTokenHash: text("access_token_hash").notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    serviceId: uuid("service_id").notNull().references(() => services.id),
    status: bookingStatus("status").notNull().default("requested"),

    propertyType: text("property_type").notNull(),
    bedrooms: smallint("bedrooms"),
    bathrooms: smallint("bathrooms"),
    sizeSqm: integer("size_sqm"),
    materials: text("materials"),
    instructions: text("instructions"),

    state: text("state").notNull(),
    city: text("city").notNull(),
    neighbourhood: text("neighbourhood"),
    address: text("address").notNull(),
    accessInstructions: text("access_instructions"),

    /** Lagos calendar date and slot; startsAt/endsAt are the resolved UTC instants. */
    scheduledDate: date("scheduled_date").notNull(),
    timeSlotId: text("time_slot_id").notNull().references(() => timeSlots.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    frequency: text("frequency").notNull().default("one_off"),

    currency: text("currency").notNull().default("NGN"),
    /** Server-computed estimate. Null when a quotation is required. Never client-supplied. */
    estimateKobo: integer("estimate_kobo"),
    /** Agreed final price, set only when staff approve or a quotation is accepted. */
    finalKobo: integer("final_kobo"),
    requiresQuotation: boolean("requires_quotation").notNull(),
    /** Frozen copy of what was agreed: service name, inclusions, exclusions, pricing config. */
    scopeSnapshot: jsonb("scope_snapshot").notNull(),

    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bookings_status_idx").on(t.status),
    index("bookings_date_idx").on(t.scheduledDate),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_slot_idx").on(t.scheduledDate, t.timeSlotId),
    check("bookings_currency_ngn", sql`${t.currency} = 'NGN'`),
    check("bookings_amounts_nonneg", sql`(${t.estimateKobo} IS NULL OR ${t.estimateKobo} >= 0) AND (${t.finalKobo} IS NULL OR ${t.finalKobo} >= 0)`),
    check("bookings_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // base | addon
    name: text("name").notNull(),
    priceKobo: integer("price_kobo").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [index("booking_items_booking_idx").on(t.bookingId), check("booking_items_valid", sql`${t.priceKobo} >= 0 AND ${t.quantity} > 0`)],
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: bookingStatus("from_status"),
    toStatus: bookingStatus("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("booking_history_booking_idx").on(t.bookingId)],
);

export const bookingNotes = pgTable(
  "booking_notes",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("booking_notes_booking_idx").on(t.bookingId)],
);

export const quotations = pgTable(
  "quotations",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull().default("NGN"),
    notes: text("notes"),
    status: quotationStatus("status").notNull().default("draft"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("quotations_booking_version_uq").on(t.bookingId, t.version),
    // At most one live (draft/sent/accepted) quotation per booking.
    uniqueIndex("quotations_one_live_uq").on(t.bookingId).where(sql`${t.status} IN ('draft','sent','accepted')`),
    check("quotations_amount_pos", sql`${t.amountKobo} > 0`),
  ],
);

// ---------- Payments ----------

export const payments = pgTable(
  "payments",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id),
    quotationId: uuid("quotation_id").references(() => quotations.id),
    provider: text("provider").notNull().default("paystack"),
    /** Our reference sent to the provider. Unique per provider: prevents duplicate charges. */
    reference: text("reference").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull().default("NGN"),
    status: paymentStatus("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    reconciled: boolean("reconciled").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.reference),
    index("payments_booking_idx").on(t.bookingId),
    check("payments_amount_pos", sql`${t.amountKobo} > 0`),
    // A payment is only 'success' once it carries a verification timestamp.
    check("payments_success_verified", sql`${t.status} NOT IN ('success','refunded','partially_refunded') OR ${t.verifiedAt} IS NOT NULL`),
  ],
);

/** One row per provider webhook event id. The unique key makes replays harmless. */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: createdAt(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payment_events_uq").on(t.provider, t.eventKey)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    amountKobo: integer("amount_kobo").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("recorded"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [check("refunds_amount_pos", sql`${t.amountKobo} > 0`)],
);

// ---------- Staff ----------

export const staffProfiles = pgTable("staff_profiles", {
  id: id(),
  userId: uuid("user_id").notNull().unique().references(() => users.id),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const staffAvailability = pgTable(
  "staff_availability",
  {
    id: id(),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0 = Sunday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    index("staff_availability_staff_idx").on(t.staffId),
    check("staff_avail_dow", sql`${t.dayOfWeek} BETWEEN 0 AND 6`),
    check("staff_avail_order", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** The migration adds an exclusion constraint so a staff member cannot hold overlapping active jobs. */
export const bookingAssignments = pgTable(
  "booking_assignments",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staffProfiles.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: assignmentStatus("status").notNull().default("active"),
    assignedBy: uuid("assigned_by").notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("assignments_booking_idx").on(t.bookingId),
    index("assignments_staff_idx").on(t.staffId, t.startsAt),
    uniqueIndex("assignments_booking_staff_active_uq").on(t.bookingId, t.staffId).where(sql`${t.status} = 'active'`),
    check("assignments_time_order", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

// ---------- Engagement & audit ----------

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().unique().references(() => bookings.id),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    /** Reviews are shown publicly only after staff approve them. */
    approved: boolean("approved").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [check("reviews_rating_range", sql`${t.rating} BETWEEN 1 AND 5`)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    channel: notificationChannel("channel").notNull(),
    recipient: text("recipient").notNull(),
    template: text("template").notNull(),
    status: notificationStatus("status").notNull().default("queued"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_booking_idx").on(t.bookingId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    /** Never put secrets or full personal data here. */
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_actor_idx").on(t.actorId, t.createdAt)],
);
