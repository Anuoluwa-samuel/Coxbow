/**
 * Money is always handled as integer minor units (kobo) plus an explicit currency.
 * 1 NGN = 100 kobo. Never use floating point for amounts.
 */
export type Currency = "NGN";

export const KOBO_PER_NAIRA = 100;

export function nairaToKobo(naira: number): number {
  return Math.round(naira * KOBO_PER_NAIRA);
}

export function formatNaira(kobo: number, currency: Currency = "NGN"): string {
  const naira = kobo / KOBO_PER_NAIRA;
  const hasKobo = kobo % KOBO_PER_NAIRA !== 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(naira);
}
