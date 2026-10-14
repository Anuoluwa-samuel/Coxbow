import { expect, test as setup } from "@playwright/test";
import { USERS } from "./constants";

// Sign in once per role and reuse the session, so tests do not trip the login rate limit.
for (const role of ["admin", "manager", "cleaner"] as const) {
  setup(`authenticate ${role}`, async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(USERS[role].email);
    await page.getByLabel("Password").fill(USERS[role].password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(role === "cleaner" ? /\/admin\/jobs$/ : /\/admin$/);
    await page.context().storageState({ path: `tests/e2e/.auth/${role}.json` });
  });
}
