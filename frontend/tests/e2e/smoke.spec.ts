import { expect, test } from "@playwright/test";

test("loads the panel shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/MCSManager Panel/i);
  await expect(page.locator("#before-app-mounted")).toHaveCount(1);
  await expect(page.locator("#app-mount-point")).toHaveCount(1);
});
