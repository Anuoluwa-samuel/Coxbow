/** Normalises Nigerian mobile numbers to E.164 (+234XXXXXXXXXX). Returns null if invalid. */
export function normaliseNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string;
  if (/^\+234\d{10}$/.test(digits)) national = digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else return null;
  // Nigerian mobile prefixes start 7, 8 or 9 (e.g. 701, 802, 903).
  if (!/^[789][01]\d{8}$/.test(national)) return null;
  return `+234${national}`;
}
