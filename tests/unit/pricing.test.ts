import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/lib/pricing";
import { demoServices } from "@/data/demo-catalog";

const svc = (slug: string) => demoServices.find((s) => s.slug === slug)!;

describe("calculatePrice", () => {
  it("picks the size tier for by_size services", () => {
    const r = calculatePrice({ service: svc("residential-cleaning"), sizeSqm: 80 });
    expect(r).toMatchObject({ kind: "estimate", totalKobo: 4_000_000 });
  });
  it("includes the upper tier boundary", () => {
    const r = calculatePrice({ service: svc("residential-cleaning"), sizeSqm: 60 });
    expect(r).toMatchObject({ kind: "estimate", totalKobo: 2_500_000 });
  });
  it("requires a quotation when size exceeds all tiers", () => {
    expect(calculatePrice({ service: svc("residential-cleaning"), sizeSqm: 500 })).toMatchObject({
      kind: "quotation",
      reason: "size_out_of_range",
    });
  });
  it("requires a quotation when size is missing", () => {
    expect(calculatePrice({ service: svc("deep-cleaning") }).requiresQuotation).toBe(true);
  });
  it("adds add-ons in integer kobo", () => {
    const r = calculatePrice({ service: svc("move-in-out-cleaning"), addonSlugs: ["inside-fridge", "inside-oven"] });
    expect(r).toMatchObject({ kind: "estimate", baseKobo: 6_000_000, totalKobo: 6_000_000 + 500_000 + 600_000 });
  });
  it("ignores duplicate add-on slugs", () => {
    const r = calculatePrice({ service: svc("move-in-out-cleaning"), addonSlugs: ["inside-fridge", "inside-fridge"] });
    expect(r).toMatchObject({ totalKobo: 6_500_000 });
  });
  it("rejects unknown add-ons", () => {
    expect(() => calculatePrice({ service: svc("move-in-out-cleaning"), addonSlugs: ["nope"] })).toThrow();
  });
  it("never prices inspection or corporate services", () => {
    expect(calculatePrice({ service: svc("post-construction-cleaning") })).toMatchObject({ kind: "quotation", reason: "inspection" });
    expect(calculatePrice({ service: svc("office-cleaning") })).toMatchObject({ kind: "quotation", reason: "corporate_quote" });
  });
});
