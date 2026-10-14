import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/server/media";
import { evaluateCustomerChange } from "@/server/customer-changes";

const bytes = (...n: number[]) => Uint8Array.from(n);

describe("sniffImageType (by content, not filename)", () => {
  it("accepts JPEG, PNG and WebP", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("rejects SVG, HTML, scripts, GIF and empty or truncated input", () => {
    for (const text of ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "<html><script>1</script>", "GIF89a", "PK\u0003\u0004", ""]) {
      expect(sniffImageType(new TextEncoder().encode(text))).toBeNull();
    }
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});

describe("evaluateCustomerChange (self-service policy)", () => {
  const now = new Date("2030-01-10T09:00:00Z");
  const base = { status: "confirmed" as const, startsAt: new Date("2030-01-15T07:00:00Z"), now, noticeHours: 24, netPaidKobo: 0, priorReschedules: 0 };
  it("allows a change with enough notice", () => {
    expect(evaluateCustomerChange(base, "cancel").ok).toBe(true);
    expect(evaluateCustomerChange(base, "reschedule").ok).toBe(true);
  });
  it("blocks inside the notice window, exactly at the boundary allowed", () => {
    expect(evaluateCustomerChange({ ...base, startsAt: new Date(now.getTime() + 23 * 3_600_000) }, "cancel")).toEqual({ ok: false, reason: "too_late" });
    expect(evaluateCustomerChange({ ...base, startsAt: new Date(now.getTime() + 24 * 3_600_000) }, "cancel").ok).toBe(true);
  });
  it("blocks self-cancel once money was paid, but still allows rescheduling", () => {
    expect(evaluateCustomerChange({ ...base, netPaidKobo: 1 }, "cancel")).toEqual({ ok: false, reason: "paid" });
    expect(evaluateCustomerChange({ ...base, netPaidKobo: 1 }, "reschedule").ok).toBe(true);
  });
  it("limits reschedules and blocks finished or closed bookings", () => {
    expect(evaluateCustomerChange({ ...base, priorReschedules: 2 }, "reschedule")).toEqual({ ok: false, reason: "reschedule_limit" });
    for (const status of ["in_progress", "completed", "cancelled", "rejected"] as const) expect(evaluateCustomerChange({ ...base, status }, "cancel")).toEqual({ ok: false, reason: "status" });
  });
});
