import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = ["/", "/services", "/services/deep-cleaning", "/book", "/about", "/gallery", "/contact", "/corporate", "/faqs", "/privacy", "/terms", "/cancellation-policy"];

test.describe("public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path}: renders, has one h1, a title, and no horizontal scroll`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await page.title()).toMatch(/Coxbow/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }

  test("an unknown service returns 404 and unknown routes show the not-found page", async ({ page }) => {
    const res = await page.goto("/services/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/find that page/i)).toBeVisible();
    const other = await page.goto("/definitely/not/a/page");
    expect(other?.status()).toBe(404);
  });

  test("navigation works at this viewport (menu button on small screens)", async ({ page, isMobile }) => {
    await page.goto("/");
    const viewport = page.viewportSize()!;
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Services" }).click();
    } else {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Services" }).click();
    }
    await expect(page).toHaveURL(/\/services$/);
    void isMobile;
  });

  test("keyboard users get a skip link and visible focus", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test("sitemap and robots are served; private areas are excluded", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/services/deep-cleaning");
    expect(sitemap).not.toContain("/admin");
  });

  test("security headers and no-store on private responses", async ({ request }) => {
    const r = await request.get("/admin/login");
    expect(r.status()).toBe(200);
    const h = r.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    const api = await request.get("/api/availability?service=deep-cleaning&date=2999-01-01");
    expect(api.headers()["cache-control"]).toContain("no-store");
  });
});
