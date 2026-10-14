import type { Addon, PricingConfig, Service } from "./catalog-types";

export interface PricingInput {
  service: Pick<Service, "pricing" | "addons">;
  sizeSqm?: number;
  addonSlugs?: string[];
}

export type PriceResult =
  | {
      kind: "estimate";
      currency: "NGN";
      baseKobo: number;
      addonLines: { slug: string; name: string; priceKobo: number }[];
      totalKobo: number;
      /** Estimates are never a confirmed final price. */
      requiresQuotation: false;
    }
  | {
      kind: "quotation";
      currency: "NGN";
      reason: "inspection" | "corporate_quote" | "size_out_of_range";
      requiresQuotation: true;
    };

function resolveAddons(service: PricingInput["service"], slugs: string[] = []): Addon[] {
  const unique = [...new Set(slugs)];
  return unique.map((slug) => {
    const addon = service.addons.find((a) => a.slug === slug && a.enabled);
    if (!addon) throw new Error(`Unknown or disabled add-on: ${slug}`);
    return addon;
  });
}

function sizeBase(config: PricingConfig, sizeSqm?: number): number | null {
  const tiers = [...(config.sizeTiers ?? [])].sort((a, b) => a.maxSqm - b.maxSqm);
  if (sizeSqm === undefined || !Number.isFinite(sizeSqm) || sizeSqm <= 0) return null;
  const tier = tiers.find((t) => sizeSqm <= t.maxSqm);
  return tier ? tier.priceKobo : null;
}

/**
 * Pure pricing calculation. All money is integer kobo. The browser may call this
 * to preview an estimate, but the server always recalculates and never trusts
 * a client-supplied total.
 */
export function calculatePrice(input: PricingInput): PriceResult {
  const { pricing } = input.service;

  if (pricing.model === "inspection" || pricing.model === "corporate_quote") {
    return {
      kind: "quotation",
      currency: pricing.currency,
      reason: pricing.model,
      requiresQuotation: true,
    };
  }

  let baseKobo: number;
  if (pricing.model === "by_size") {
    const base = sizeBase(pricing, input.sizeSqm);
    if (base === null) {
      return {
        kind: "quotation",
        currency: pricing.currency,
        reason: "size_out_of_range",
        requiresQuotation: true,
      };
    }
    baseKobo = base;
  } else {
    if (pricing.baseKobo === undefined) throw new Error("Pricing config missing baseKobo");
    baseKobo = pricing.baseKobo;
  }

  const addons = pricing.model === "fixed" ? [] : resolveAddons(input.service, input.addonSlugs);
  const addonLines = addons.map((a) => ({ slug: a.slug, name: a.name, priceKobo: a.priceKobo }));
  const totalKobo = addonLines.reduce((sum, l) => sum + l.priceKobo, baseKobo);

  if (!Number.isSafeInteger(totalKobo) || totalKobo < 0) throw new Error("Invalid price total");

  return {
    kind: "estimate",
    currency: pricing.currency,
    baseKobo,
    addonLines,
    totalKobo,
    requiresQuotation: false,
  };
}
