import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { USERS, openDate } from "./constants";

let seq = Math.floor(Math.random() * 9000) + 1000;
const phone = () => `0805${String(++seq).padStart(4, "0")}${String(Math.floor(Math.random() * 900) + 100)}`;

async function createBooking(request: APIRequestContext, over: Record<string, unknown> = {}) {
  const res = await request.post("/api/bookings", {
    data: { idempotencyKey: crypto.randomUUID(), serviceSlug: "residential-cleaning", propertyType: "apartment", bedrooms: 2, bathrooms: 1, sizeSqm: 70, materials: "company_supplies", state: "Lagos", city: "Yaba", address: "21 Admin Test Road", date: openDate(15), timeSlotId: "morning", customerName: "Admin Flow", customerPhone: phone(), consent: true, ...over },
  });
  expect(res.status()).toBe(201);
  return res.json() as Promise<{ reference: string; accessToken: string }>;
}

const as = (browser: Browser, role: "admin" | "manager" | "cleaner") => browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });

test.describe("access control", () => {
  test("anonymous visitors are sent to sign in", async ({ page }) => {
    await page.goto("/admin/bookings");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("wrong credentials show one generic message", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(USERS.admin.email);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Incorrect email or password");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a manager cannot reach admin-only pages", async ({ browser }) => {
    const ctx = await as(browser, "manager");
    const page = await ctx.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Services" })).toBeVisible(); // read-only list is allowed
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    for (const path of ["/admin/audit", "/admin/areas", "/admin/services/deep-cleaning"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/forbidden/);
    }
    await ctx.close();
  });

  test("a cleaner sees only My jobs and is blocked from everything else", async ({ browser }) => {
    const ctx = await as(browser, "cleaner");
    const page = await ctx.newPage();
    await expect(async () => { await page.goto("/admin/jobs"); await expect(page.getByRole("heading", { name: "My jobs" })).toBeVisible(); }).toPass();
    await expect(page.getByRole("link", { name: "Bookings" })).toHaveCount(0);
    for (const path of ["/admin", "/admin/bookings", "/admin/customers", "/admin/payments", "/admin/staff"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/(forbidden|jobs)/);
    }
    await ctx.close();
  });

  test("admin API-style access without a session is refused", async ({ request }) => {
    const res = await request.get("/admin/bookings", { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/admin/login");
  });
});

test.describe("admin workflow", () => {
  test("approve a booking, assign a cleaner, and the cleaner completes the job", async ({ browser, request }) => {
    const b = await createBooking(request);
    const adminCtx = await as(browser, "admin");
    const admin = await adminCtx.newPage();
    admin.on("dialog", (d) => d.accept());

    await admin.goto("/admin/bookings");
    await admin.getByLabel("Search", { exact: true }).fill(b.reference);
    await admin.getByRole("button", { name: "Apply filters" }).click();
    await admin.getByRole("link", { name: b.reference }).click();
    await expect(admin.getByText(/^requested$/i).first()).toBeVisible();

    // A request is not confirmed until staff approve it.
    await admin.getByRole("button", { name: "Approve and confirm" }).click();
    await expect(admin.getByText("Booking is now confirmed.")).toBeVisible();
    await expect(admin.getByText(/^confirmed$/i).first()).toBeVisible();

    await admin.getByLabel("Cleaner").selectOption({ label: USERS.cleaner.name });
    await admin.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(admin.getByText("Cleaner assigned.")).toBeVisible();
    await expect(admin.getByText(/^scheduled$/i).first()).toBeVisible();
    await adminCtx.close();

    const cleanerCtx = await as(browser, "cleaner");
    const cleaner = await cleanerCtx.newPage();
    await cleaner.goto("/admin/jobs");
    await cleaner.getByRole("link", { name: openDate(15) }).first().click();
    await cleaner.getByRole("button", { name: "Start job" }).click();
    await expect(cleaner.getByText("Booking is now in progress.")).toBeVisible();
    cleaner.on("dialog", (d) => d.accept());
    await cleaner.getByRole("button", { name: "Mark completed" }).click();
    await expect(cleaner.getByText("Booking is now completed.")).toBeVisible();
    await expect(cleaner.getByRole("button", { name: "Cancel booking" })).toHaveCount(0); // cleaners cannot cancel
    await cleanerCtx.close();
  });

  test("the same cleaner cannot be double-booked", async ({ browser, request }) => {
    const date = openDate(16);
    const [one, two] = [await createBooking(request, { date, timeSlotId: "midday" }), await createBooking(request, { date, timeSlotId: "midday" })];
    const ctx = await as(browser, "manager");
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept());
    for (const [i, b] of [one, two].entries()) {
      await page.goto("/admin/bookings");
      await page.getByLabel("Search", { exact: true }).fill(b.reference);
      await page.getByRole("button", { name: "Apply filters" }).click();
      await page.getByRole("link", { name: b.reference }).click();
      await page.getByRole("button", { name: "Approve and confirm" }).click();
      await expect(page.getByText("Booking is now confirmed.")).toBeVisible();
      await page.getByLabel("Cleaner").selectOption({ label: USERS.cleaner.name });
      await page.getByRole("button", { name: "Assign", exact: true }).click();
      if (i === 0) await expect(page.getByText("Cleaner assigned.")).toBeVisible();
      else await expect(page.getByText("That cleaner already has a job at this time")).toBeVisible();
    }
    await ctx.close();
  });

  test("quotation: staff send a price, the customer accepts, then staff confirm", async ({ browser, request, page }) => {
    const b = await createBooking(request, { serviceSlug: "post-construction-cleaning", materials: undefined, date: openDate(17) });
    const adminCtx = await as(browser, "admin");
    const admin = await adminCtx.newPage();
    admin.on("dialog", (d) => d.accept());
    await admin.goto("/admin/bookings");
    await admin.getByLabel("Search", { exact: true }).fill(b.reference);
    await admin.getByRole("button", { name: "Apply filters" }).click();
    await admin.getByRole("link", { name: b.reference }).click();

    await admin.getByRole("button", { name: "Approve and confirm" }).click();
    await expect(admin.getByText(/accept a quotation/i).first()).toBeVisible(); // blocked: no accepted quotation yet

    await admin.getByLabel("Amount (₦)").fill("150000");
    await admin.getByRole("button", { name: "Send quotation" }).click();
    await expect(admin.getByText("Quotation sent.")).toBeVisible();

    await page.goto(`/book/confirmation/${b.reference}?t=${b.accessToken}`);
    await expect(page.getByText("₦150,000").first()).toBeVisible();
    await page.getByRole("button", { name: "Accept quotation" }).click();
    await expect(page.getByText(/You accepted the quotation/)).toBeVisible();

    await admin.reload();
    await admin.getByRole("button", { name: "Approve and confirm" }).click();
    await expect(admin.getByText("Booking is now confirmed.")).toBeVisible();
    await expect(admin.getByText("₦150,000").first()).toBeVisible();
    await adminCtx.close();
  });

  test("dashboard figures are live, and the audit log records the actions", async ({ browser }) => {
    const ctx = await as(browser, "admin");
    const page = await ctx.newPage();
    await page.goto("/admin");
    await expect(page.getByText("New requests")).toBeVisible();
    await expect(page.getByText("Revenue (verified)")).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByText("booking.confirmed").first()).toBeVisible();
    await ctx.close();
  });

  test("admin can disable a service and it disappears from the public site", async ({ browser, page }) => {
    const ctx = await as(browser, "admin");
    const admin = await ctx.newPage();
    await admin.goto("/admin/services/floor-care");
    await admin.getByLabel("Enabled (visible and bookable)").uncheck();
    await admin.getByRole("button", { name: "Save service" }).click();
    await expect(admin.getByText("Service saved.")).toBeVisible();
    await expect.poll(async () => (await page.goto("/services/floor-care"))?.status(), { timeout: 15_000 }).toBe(404);
    await admin.getByLabel("Enabled (visible and bookable)").check();
    await admin.getByRole("button", { name: "Save service" }).click();
    await expect(admin.getByText("Service saved.")).toBeVisible();
    await ctx.close();
  });
});
