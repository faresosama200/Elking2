const path = require("path");
const { pathToFileURL } = require("url");
const { test, expect } = require("@playwright/test");

test("landing page renders key CTA", async ({ page }) => {
  const landingPagePath = path.resolve(__dirname, "../../../index.html");
  await page.goto(pathToFileURL(landingPagePath).href);
  await expect(page).toHaveTitle(/TalentHub/i);
  await expect(page.getByRole("link", { name: /get started|ابدأ الآن/i }).first()).toBeVisible();
});
