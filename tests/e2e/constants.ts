/** Credentials that exist ONLY in the throwaway e2e database (coxbow_test), created by prepare.ts. */
export const E2E_PORT = 3200;
export const BASE_URL = `http://localhost:${E2E_PORT}`;
export const USERS = {
  admin: { email: "e2e-admin@example.test", password: "e2e-admin-password-1", name: "E2E Admin" },
  manager: { email: "e2e-manager@example.test", password: "e2e-manager-password-1", name: "E2E Manager" },
  cleaner: { email: "e2e-cleaner@example.test", password: "e2e-cleaner-password-1", name: "E2E Cleaner" },
} as const;

/** Next open (non-Sunday) Lagos calendar date at least `days` ahead, as YYYY-MM-DD. */
export function openDate(days: number): string {
  const d = new Date(Date.now() + 60 * 60 * 1000 + days * 86_400_000);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
