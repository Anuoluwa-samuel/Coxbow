import { expect, test, type Page } from "@playwright/test";
import { openDate as baseOpenDate } from "./constants";
import { withDb } from "./db";

/** Each viewport project books on different days, so runs never compete for the same slot. */
const OFFSET: Record<string, number> = { desktop: 0, tablet: 60, mobile: 120 };
const openDate = (days: number) => baseOpenDate(days + (OFFSET[test.info().project.name] ?? 0));

let phoneSeq = Math.floor(Math.random() * 9000) + 1000;
const phone = () => `0803${String(++phoneSeq).padStart(4, "0")}${String(Math.floor(Math.random() * 900) + 100)}`;

async function openWizard(page: Page, query = "") {
  await page.goto(`/book${query}`);
  await expect(page.getByRole("heading", { name: "Tell us what you need" })).toBeVisible();
}

async function fillWizardToReview(page: Page, opts: { date: string; slot?: string; service?: string; name?: string } ) {
  await openWizard(page);
  await page.locator("main").getByText(opts.service ?? "Residential Cleaning", { exact: true }).first().click();
  await page.getByLabel(new RegExp("^Property\ type")).selectOption("apartment");
  await page.getByLabel(new RegExp("^Bedrooms")).fill("2");
  await page.getByLabel(new RegExp("^Bathrooms")).fill("2");
  await page.getByLabel(/^Approximate size/).fill("80");
  await page.getByText("We bring materials").click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(new RegExp("^State")).selectOption("Lagos");
  await page.getByLabel(new RegExp("^City\ /\ area")).selectOption("Yaba");
  await page.getByLabel(new RegExp("^Service\ address")).fill("12 Example Street, Yaba");
  await page.getByLabel(new RegExp("^Preferred\ date")).fill(opts.date);
  await page.getByText(opts.slot ?? "8:00 am – 11:00 am").click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(new RegExp("^Full\ name")).fill(opts.name ?? "E2E Customer");
  await page.getByLabel(new RegExp("^Phone\ number")).fill(phone());
  await page.getByLabel(/^Email/).fill("e2e.customer@example.test");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("customer booking", () => {
  test("home page explains the service and offers a booking CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("properly cleaned space");
    await expect(page.getByRole("link", { name: "Book a clean" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore services" })).toBeVisible();
  });

  test("a customer can submit a valid booking and sees a reference only after it is saved", async ({ page }) => {
    await fillWizardToReview(page, { date: openDate(5), name: "Ada E2E" });
    await expect(page.getByText("Estimated price (not final)")).toBeVisible();
    await expect(page.getByText("₦40,000").first()).toBeVisible();
    await page.getByRole("button", { name: "Submit booking request" }).click();
    await expect(page).toHaveURL(/\/book\/confirmation\/CXB-[A-Z2-9]{8}\?t=/);
    await expect(page.getByRole("heading", { name: "Booking request received" })).toBeVisible();
    const reference = (await page.locator("p.font-mono").innerText()).trim();
    const rows = await withDb((sql) => sql`select status, estimate_kobo from bookings where reference = ${reference}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "requested", estimate_kobo: 4_000_000 });
  });

  test("validation blocks an incomplete step and explains why", async ({ page }) => {
    await openWizard(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("main").getByRole("alert").first()).toContainText("Choose a service");
    await page.getByText("Residential Cleaning", { exact: true }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose a property type")).toBeVisible();
  });

  test("rejects an invalid phone number and missing consent on the details step", async ({ page }) => {
    await openWizard(page);
    await page.locator("main").getByText("Residential Cleaning", { exact: true }).first().click();
    await page.getByLabel(new RegExp("^Property\ type")).selectOption("apartment");
    await page.getByLabel(new RegExp("^Bedrooms")).fill("1");
    await page.getByLabel(new RegExp("^Bathrooms")).fill("1");
    await page.getByText("We bring materials").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(new RegExp("^State")).selectOption("Lagos");
    await page.getByLabel(new RegExp("^City\ /\ area")).selectOption("Yaba");
    await page.getByLabel(new RegExp("^Service\ address")).fill("5 Test Road, Yaba");
    await page.getByLabel(new RegExp("^Preferred\ date")).fill(openDate(7));
    await page.getByText("11:00 am – 2:00 pm").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(new RegExp("^Full\ name")).fill("Bad Phone");
    await page.getByLabel(new RegExp("^Phone\ number")).fill("12345");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid Nigerian phone number")).toBeVisible();
    await expect(page.getByText("You must accept the privacy notice")).toBeVisible();
  });

  test("a full time slot is shown as unavailable and cannot be chosen", async ({ page, request }) => {
    const date = openDate(9);
    await withDb((sql) => sql`update time_slots set capacity = 1 where id = 'afternoon'`);
    const res = await request.post("/api/bookings", {
      data: { idempotencyKey: crypto.randomUUID(), serviceSlug: "residential-cleaning", propertyType: "apartment", bedrooms: 1, bathrooms: 1, materials: "company_supplies", state: "Lagos", city: "Yaba", address: "9 Filler Street", date, timeSlotId: "afternoon", customerName: "Slot Filler", customerPhone: phone(), consent: true },
    });
    expect(res.status()).toBe(201);

    await openWizard(page, "?service=residential-cleaning");
    await page.getByLabel(new RegExp("^Property\ type")).selectOption("apartment");
    await page.getByLabel(new RegExp("^Bedrooms")).fill("1");
    await page.getByLabel(new RegExp("^Bathrooms")).fill("1");
    await page.getByText("We bring materials").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(new RegExp("^State")).selectOption("Lagos");
    await page.getByLabel(new RegExp("^City\ /\ area")).selectOption("Yaba");
    await page.getByLabel(new RegExp("^Preferred\ date")).fill(date);
    const full = page.locator("label", { hasText: "2:00 pm – 5:00 pm" });
    await expect(full).toContainText("Fully booked");
    await expect(full.locator("input")).toBeDisabled();
    await withDb((sql) => sql`update time_slots set capacity = 50 where id = 'afternoon'`);
  });

  test("the server refuses a slot that is taken even if the browser tries to submit it", async ({ request }) => {
    const date = openDate(11);
    await withDb((sql) => sql`update time_slots set capacity = 1 where id = 'midday'`);
    const payload = (n: string) => ({ idempotencyKey: crypto.randomUUID(), serviceSlug: "residential-cleaning", propertyType: "apartment", bedrooms: 1, bathrooms: 1, materials: "company_supplies", state: "Lagos", city: "Yaba", address: `${n} Race Road`, date, timeSlotId: "midday", customerName: "Racer", customerPhone: phone(), consent: true });
    const [a, b] = await Promise.all([request.post("/api/bookings", { data: payload("1") }), request.post("/api/bookings", { data: payload("2") })]);
    expect([a.status(), b.status()].sort()).toEqual([201, 409]);
    await withDb((sql) => sql`update time_slots set capacity = 50 where id = 'midday'`);
  });

  test("a duplicate submission does not create a second booking", async ({ request }) => {
    const data = { idempotencyKey: crypto.randomUUID(), serviceSlug: "deep-cleaning", propertyType: "apartment", bedrooms: 1, bathrooms: 1, sizeSqm: 50, materials: "company_supplies", state: "Lagos", city: "Yaba", address: "3 Dup Street", date: openDate(12), timeSlotId: "morning", customerName: "Dup Test", customerPhone: phone(), consent: true };
    const first = await request.post("/api/bookings", { data });
    const second = await request.post("/api/bookings", { data });
    expect(first.status()).toBe(201);
    expect(second.status()).toBe(200);
    expect((await first.json()).reference).toBe((await second.json()).reference);
  });

  test("a customer cannot open another customer's booking or guess a reference", async ({ page, request }) => {
    const mk = async (name: string) => (await request.post("/api/bookings", { data: { idempotencyKey: crypto.randomUUID(), serviceSlug: "residential-cleaning", propertyType: "apartment", bedrooms: 1, bathrooms: 1, materials: "company_supplies", state: "Lagos", city: "Yaba", address: `${name} Street`, date: openDate(13), timeSlotId: "morning", customerName: name, customerPhone: phone(), consent: true } })).json();
    const alice = await mk("Alice Private");
    const bob = await mk("Bob Private");
    await page.goto(`/book/confirmation/${alice.reference}?t=${alice.accessToken}`);
    await expect(page.getByText("Thank you, Alice")).toBeVisible();
    await page.goto(`/book/confirmation/${alice.reference}?t=${bob.accessToken}`);
    await expect(page.getByText("Alice")).toHaveCount(0);
    await expect(page.getByText(/find that page/i)).toBeVisible();
    await page.goto(`/book/confirmation/${alice.reference}`);
    await expect(page.getByText("Alice")).toHaveCount(0);
  });

  test("an inspection-based service creates a quotation request, not a priced booking", async ({ page }) => {
    await openWizard(page, "?service=post-construction-cleaning");
    await page.getByLabel(new RegExp("^Property\ type")).selectOption("apartment");
    await page.getByLabel(new RegExp("^Bedrooms")).fill("3");
    await page.getByLabel(new RegExp("^Bathrooms")).fill("2");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(new RegExp("^State")).selectOption("Lagos");
    await page.getByLabel(new RegExp("^City\ /\ area")).selectOption("Yaba");
    await page.getByLabel(new RegExp("^Service\ address")).fill("77 Builders Avenue, Yaba");
    await page.getByLabel(new RegExp("^Preferred\ date")).fill(openDate(14));
    await page.getByText("8:00 am – 11:00 am").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(new RegExp("^Full\ name")).fill("Quote Seeker");
    await page.getByLabel(new RegExp("^Phone\ number")).fill(phone());
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Review your quotation request" })).toBeVisible();
    await expect(page.getByText("This will be a quotation request")).toBeVisible();
    await page.getByRole("button", { name: "Request quotation" }).click();
    await expect(page.getByRole("heading", { name: "Quotation request received" })).toBeVisible();
    await expect(page.getByText("To be quoted")).toBeVisible();
  });
});
