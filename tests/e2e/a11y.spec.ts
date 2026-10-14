import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** WCAG 2.1 A/AA automated checks. Automated tools find roughly a third of issues; this is a floor, not a full audit. */
const PAGES = ["/", "/services", "/services/deep-cleaning", "/book", "/contact", "/faqs", "/about", "/corporate", "/privacy", "/admin/login"];

for (const path of PAGES) {
  test(`a11y: ${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
