const path = require("path");
const { pathToFileURL } = require("url");
const { test, expect } = require("@playwright/test");

test("login page submits and redirects by role", async ({ page }) => {
  const loginPagePath = path.resolve(__dirname, "../../../login/login.html");

  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" })
    });
  });

  await page.route("**/auth/login", async (route) => {
    const requestBody = route.request().postDataJSON();
    if (requestBody.email !== "admin@talenthub.local" || requestBody.password !== "Admin1234") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Invalid credentials" })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Login successful",
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
        user: {
          id: "admin-id",
          fullName: "System Admin",
          email: "admin@talenthub.local",
          role: "ADMIN",
          status: "ACTIVE"
        }
      })
    });
  });

  await page.goto(pathToFileURL(loginPagePath).href);

  await page.locator("#email").fill("admin@talenthub.local");
  await page.locator("#password").fill("Admin1234");
  await page.getByRole("button", { name: /دخول/i }).click();

  await expect(page).toHaveURL(/dashbord\/admin\/dashbord\.html$/);

  const storedUser = await page.evaluate(() => JSON.parse(localStorage.getItem("th_user") || "null"));
  expect(storedUser?.role).toBe("ADMIN");
});
