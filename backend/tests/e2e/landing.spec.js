const { test, expect } = require("@playwright/test");

test("landing page renders key CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TalentHub/i);
  await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
});
