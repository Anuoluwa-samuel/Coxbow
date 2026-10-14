import type { Currency } from "./money";

export type PricingModel =
  | "fixed"
  | "by_size"
  | "base_plus_addons"
  | "inspection"
  | "corporate_quote";

export type PropertyType =
  | "apartment"
  | "duplex"
  | "bungalow"
  | "terrace"
  | "detached"
  | "office"
  | "shop"
  | "other";

export interface SizeTier {
  /** Inclusive upper bound in square metres. */
  maxSqm: number;
  priceKobo: number;
}

export interface PricingConfig {
  model: PricingModel;
  currency: Currency;
  /** fixed / base_plus_addons / by_size base amount. */
  baseKobo?: number;
  /** by_size: price tiers by approximate property size. */
  sizeTiers?: SizeTier[];
}

/** Which optional booking inputs are relevant to a service. */
export interface ServiceFields {
  rooms: boolean; // bedrooms / bathrooms
  sizeSqm: boolean;
  recurring: boolean;
  materials: boolean; // who supplies cleaning materials
}

export interface Faq {
  q: string;
  a: string;
}

export interface Addon {
  slug: string;
  name: string;
  description?: string;
  priceKobo: number;
  enabled: boolean;
}

export interface Service {
  slug: string;
  name: string;
  categorySlug: string;
  summary: string;
  description: string;
  idealFor: string[];
  includes: string[];
  excludes: string[];
  extraCharges: string[];
  pricing: PricingConfig;
  pricingNote: string;
  fields: ServiceFields;
  propertyTypes: PropertyType[];
  addons: Addon[];
  faqs: Faq[];
  relatedSlugs: string[];
  /** Only enabled services are shown or bookable. */
  enabled: boolean;
  popular: boolean;
  /** Minimum notice in hours before a booking can start. */
  minNoticeHours: number;
  /** Typical job duration used for scheduling. */
  durationMinutes: number;
  sortOrder: number;
  /** Uploaded photo, served from /media/{imageId}. Absent until an admin uploads one. */
  imageId?: string;
  imageAlt?: string;
}

export interface ServiceCategory {
  slug: string;
  name: string;
  audience: "residential" | "commercial" | "both";
  description: string;
  sortOrder?: number;
}

export interface ServiceArea {
  state: string;
  city: string;
  /** Empty means the whole city is covered. */
  neighbourhoods: string[];
  enabled: boolean;
}

export interface TimeSlot {
  id: string;
  label: string;
  startHour: number; // 24h, Africa/Lagos
  endHour: number;
}
