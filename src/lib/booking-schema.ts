import { z } from "zod";
import { normaliseNigerianPhone } from "./phone";

const text = (max: number) => z.string().trim().max(max);

export const bookingInputSchema = z.object({
  /** Client-generated key so a double-click or retry cannot create two bookings. */
  idempotencyKey: z.string().uuid(),
  serviceSlug: z.string().min(1).max(100),
  propertyType: z.enum(["apartment", "duplex", "bungalow", "terrace", "detached", "office", "shop", "other"]),
  bedrooms: z.number().int().min(0).max(30).optional(),
  bathrooms: z.number().int().min(0).max(30).optional(),
  sizeSqm: z.number().int().min(1).max(100000).optional(),
  addonSlugs: z.array(z.string().max(100)).max(20).default([]),
  materials: z.enum(["company_supplies", "customer_supplies"]).optional(),
  instructions: text(1000).optional(),

  state: text(80).min(1, "Select a state"),
  city: text(80).min(1, "Select a city"),
  neighbourhood: text(120).optional(),
  address: text(300).min(5, "Enter the service address"),
  accessInstructions: text(500).optional(),
  /** Calendar date in Africa/Lagos, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  timeSlotId: z.string().min(1, "Choose a time slot"),
  frequency: z.enum(["one_off", "weekly", "fortnightly", "monthly"]).default("one_off"),

  customerName: text(120).min(2, "Enter your name"),
  customerPhone: z
    .string()
    .transform((v, ctx) => {
      const n = normaliseNigerianPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian phone number" });
        return z.NEVER;
      }
      return n;
    }),
  customerEmail: z.string().trim().toLowerCase().email("Enter a valid email").max(200).optional().or(z.literal("").transform(() => undefined)),
  consent: z.literal(true, { error: "You must accept the privacy notice to continue" }),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
