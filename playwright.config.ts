import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
import { BASE_URL, E2E_PORT } from "./tests/e2e/constants";

config({ path: ".env.local" });

// Use the locally installed Google Chrome so no browser download is needed.
const chrome = { channel: "chrome" as const };

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure", ...chrome },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", testMatch: /(customer|admin|pages|features)\.spec\.ts/, dependencies: ["setup"], use: { viewport: { width: 1280, height: 800 } } },
    { name: "a11y", testMatch: /a11y\.spec\.ts/, use: { viewport: { width: 1280, height: 800 } } },
    { name: "tablet", testMatch: /(customer|pages)\.spec\.ts/, dependencies: ["setup"], use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "mobile", testMatch: /(customer|pages|features)\.spec\.ts/, dependencies: ["setup"], use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: "node tests/e2e/mock-paystack.mjs", port: 3300, reuseExistingServer: true },
    {
    // Production build, so e2e exercises what ships. DATABASE_URL points at the TEST database.
    command: `pnpm build && pnpm exec next start --port ${E2E_PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      APP_SECRET: process.env.APP_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-123456",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_DEMO_MODE: "true",
      EMAIL_PROVIDER: "console",
      BOOKING_RATE_LIMIT: "1000", // production default is 8 per 10 min per IP; e2e makes many bookings from one IP
      PAYSTACK_SECRET_KEY: "sk_test_e2e_mock",
      PAYSTACK_BASE_URL: "http://localhost:3300",
    },
  },
  ],
});
