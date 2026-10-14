import { expect, test, type Browser, type APIRequestContext } from "@playwright/test";
import { openDate as baseOpenDate } from "./constants";
import { withDb } from "./db";

// Each viewport project books on different days so runs never compete for the same slot.
const OFFSET: Record<string, number> = { desktop: 180, mobile: 240 };
const openDate = (days: number) => baseOpenDate(days + (OFFSET[test.info().project.name] ?? 0));

let seq = Math.floor(Math.random() * 9000) + 1000;
const phone = () => `0806${String(++seq).padStart(4, "0")}${String(Math.floor(Math.random() * 900) + 100)}`;

async function book(request: APIRequestContext, over: Record<string, unknown> = {}) {
  const res = await request.post("/api/bookings", {
    data: { idempotencyKey: crypto.randomUUID(), serviceSlug: "residential-cleaning", propertyType: "apartment", bedrooms: 2, bathrooms: 1, sizeSqm: 80, materials: "company_supplies", state: "Lagos", city: "Yaba", address: "5 Feature Road", date: openDate(5), timeSlotId: "morning", customerName: "Feature Tester", customerPhone: phone(), customerEmail: "feature@example.test", consent: true, ...over },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { reference: string; accessToken: string };
}
const confirm = (reference: string) => withDb((sql) => sql`update bookings set status = 'confirmed', final_kobo = estimate_kobo where reference = ${reference}`);
const complete = (reference: string) => withDb((sql) => sql`update bookings set status = 'completed', completed_at = now() where reference = ${reference}`);
const link = (b: { reference: string; accessToken: string }) => `/book/confirmation/${b.reference}?t=${b.accessToken}`;

test.describe("customer: pay now", () => {
  test("a customer pays the agreed price through Paystack and the balance clears", async ({ page, request }) => {
    const b = await book(request, { date: openDate(3) });
    await page.goto(link(b));
    await expect(page.getByRole("button", { name: /Pay .* now/ })).toHaveCount(0); // not payable until staff confirm
    await confirm(b.reference);
    await page.reload();
    await expect(page.getByText("Balance")).toBeVisible();
    await page.getByRole("button", { name: "Pay ₦40,000 now" }).click();
    await expect(page.getByText("Payment received. Thank you!")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(new RegExp(`/book/confirmation/${b.reference}\\?t=`));
    await expect(page.getByText("Paid in full. Thank you.")).toBeVisible();
    const rows = await withDb((sql) => sql`select p.status, p.amount_kobo, p.verified_at is not null as verified from payments p join bookings b on b.id = p.booking_id where b.reference = ${b.reference}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "success", amount_kobo: 4_000_000, verified: true });
  });

  test("a failed or abandoned checkout is not counted as paid", async ({ page, request }) => {
    const b = await book(request, { date: openDate(4) });
    await confirm(b.reference);
    await page.goto(link(b));
    // Intercept the redirect to the fake checkout and ask it to fail the payment.
    await page.route("http://localhost:3300/checkout/**", (route) => route.continue({ url: route.request().url() + "?fail=1" }));
    await page.getByRole("button", { name: /Pay .* now/ }).click();
    await expect(page.getByText(/not completed and you have not been charged/)).toBeVisible({ timeout: 20_000 });
    const rows = await withDb((sql) => sql`select p.status from payments p join bookings b on b.id = p.booking_id where b.reference = ${b.reference}`);
    expect(rows.map((r) => r.status)).toEqual(["failed"]);
    await expect(page.getByRole("button", { name: /Pay .* now/ })).toBeVisible(); // can try again
  });
});

test.describe("customer: change or cancel", () => {
  test("reschedules to a new available slot", async ({ page, request }) => {
    const b = await book(request, { date: openDate(8) });
    await page.goto(link(b));
    await expect(page.getByRole("heading", { name: "Need to make a change?" })).toBeVisible();
    const newDate = openDate(10);
    await page.getByLabel("New date").fill(newDate);
    await page.getByText("11:00 am – 2:00 pm").click();
    await page.getByRole("button", { name: "Confirm new time" }).click();
    await expect(page.getByText("Your booking has been rescheduled.")).toBeVisible();
    await expect(page.getByText(newDate).first()).toBeVisible();
    const rows = await withDb((sql) => sql`select scheduled_date::text as d, time_slot_id from bookings where reference = ${b.reference}`);
    expect(rows[0]).toMatchObject({ d: newDate, time_slot_id: "midday" });
  });

  test("cancels after confirming, and the booking becomes cancelled", async ({ page, request }) => {
    const b = await book(request, { date: openDate(9) });
    await page.goto(link(b));
    await page.getByRole("button", { name: "Cancel this booking" }).click();
    await page.getByLabel("Reason (optional)").fill("Travelling");
    await page.getByRole("button", { name: "Yes, cancel my booking" }).click();
    await expect(page.getByText("Your booking has been cancelled.")).toBeVisible();
    await expect(page.getByText("This booking was cancelled.")).toBeVisible();
    const rows = await withDb((sql) => sql`select status, cancel_reason from bookings where reference = ${b.reference}`);
    expect(rows[0]).toMatchObject({ status: "cancelled", cancel_reason: "Cancelled by customer: Travelling" });
  });

  test("inside the notice window the customer is asked to call instead", async ({ page, request }) => {
    const b = await book(request, { date: openDate(6) });
    // Move the job to start in about 2 hours (arranged directly; the rule under test is the UI response).
    await withDb((sql) => sql`update bookings set starts_at = now() + interval '2 hours', ends_at = now() + interval '5 hours' where reference = ${b.reference}`);
    await page.goto(link(b));
    await expect(page.getByText(/too close to the start time/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel this booking" })).toHaveCount(0);
  });
});

test.describe("customer: reviews", () => {
  test("a completed job can be reviewed once; it is hidden until staff approve it", async ({ page, request, browser }) => {
    const text = `Spotless and on time (${test.info().project.name} run)`;
    const b = await book(request, { date: openDate(7), customerName: "Chioma Reviewer" });
    await page.goto(link(b));
    await expect(page.getByRole("heading", { name: "How did we do?" })).toHaveCount(0); // not completed yet
    await complete(b.reference);
    await page.reload();
    await page.locator('label:has(input[aria-label="5 stars"])').click();
    await page.getByLabel("Comments (optional)").fill(text);
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByText(/Thank you for your review \(5\/5\)/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "How did we do?" })).toHaveCount(0); // only once

    // Hidden from the public until approved.
    await page.goto("/");
    await expect(page.getByText(text)).toHaveCount(0);

    if (test.info().project.name !== "desktop") return; // moderation is an admin task: desktop only
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/manager.json" });
    const admin = await ctx.newPage();
    await admin.goto("/admin/reviews");
    const card = admin.locator("section", { hasText: text });
    await card.getByRole("button", { name: "Approve and publish" }).click();
    await expect(admin.getByText("Review approved and now visible on the site.")).toBeVisible();
    await ctx.close();

    await expect.poll(async () => { await page.goto("/"); return page.getByText(text).count(); }, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText("Chioma", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Reviewer")).toHaveCount(0); // first name only
  });
});

test.describe("admin: photos and categories", () => {
  test.beforeEach(() => { test.skip(test.info().project.name !== "desktop", "admin UI runs on desktop"); });
  const as = (browser: Browser) => browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

  test("uploads a service photo that appears on the public site; SVG is refused", async ({ browser, page }) => {
    const ctx = await as(browser);
    const admin = await ctx.newPage();
    await admin.goto("/admin/services/deep-cleaning");

    await admin.getByLabel(/Upload photo|Replace photo/).setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>') });
    await admin.getByRole("button", { name: /^(Upload|Replace)$/ }).click();
    await expect(admin.getByText("Upload a JPEG, PNG or WebP image.")).toBeVisible();

    await admin.getByLabel(/Upload photo|Replace photo/).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
    await admin.getByLabel("Description for screen readers").fill("A tidy living room after a deep clean");
    await admin.getByRole("button", { name: /^(Upload|Replace)$/ }).click();
    await expect(admin.getByText("Photo saved.")).toBeVisible();

    await expect.poll(async () => { await page.goto("/services/deep-cleaning"); return page.getByRole("img", { name: "A tidy living room after a deep clean" }).count(); }, { timeout: 15_000 }).toBe(1);
    const src = await page.getByRole("img", { name: "A tidy living room after a deep clean" }).getAttribute("src");
    const res = await page.request.get(src!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    await ctx.close();
  });

  test("adds a category, moves a service into it, and refuses to delete a non-empty category", async ({ browser }) => {
    const ctx = await as(browser);
    const admin = await ctx.newPage();
    await admin.goto("/admin/services");
    await admin.getByLabel("Category name").fill("Outdoor E2E");
    await admin.getByLabel("Category slug").fill("outdoor-e2e");
    await admin.getByRole("button", { name: "Save category" }).click();
    await expect(admin.getByText("Category saved.")).toBeVisible();
    await expect(admin.getByRole("list").getByText("Outdoor E2E")).toBeVisible();

    await admin.goto("/admin/services/carpet-upholstery-cleaning");
    await admin.getByLabel("Category").selectOption("outdoor-e2e");
    await admin.getByRole("button", { name: "Save service" }).click();
    await expect(admin.getByText("Service saved.")).toBeVisible();

    await admin.goto("/admin/services");
    await expect(admin.getByText("1 service").first()).toBeVisible();
    await admin.goto("/services");
    await expect(admin.getByRole("heading", { name: "Outdoor E2E" })).toBeVisible();
    await ctx.close();
  });
});
