import type { PropertyType } from "@/lib/catalog-types";

export interface BookingDraft {
  serviceSlug: string;
  propertyType: PropertyType | "";
  bedrooms: string;
  bathrooms: string;
  sizeSqm: string;
  addonSlugs: string[];
  materials: "company_supplies" | "customer_supplies" | "";
  instructions: string;
  state: string;
  city: string;
  neighbourhood: string;
  address: string;
  accessInstructions: string;
  date: string;
  timeSlotId: string;
  frequency: "one_off" | "weekly" | "fortnightly" | "monthly";
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  consent: boolean;
}

export type Errors = Partial<Record<keyof BookingDraft, string>>;

export interface StepProps {
  draft: BookingDraft;
  errors: Errors;
  set: <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => void;
}

export interface SlotInfo {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
}

export const STEPS = ["Service", "Location & time", "Your details", "Review"] as const;
