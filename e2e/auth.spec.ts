import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("visitante não autenticado é redirecionado para /login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  await expect(page.locator('input[name="email"]')).toBeVisible();
});

test("login com credenciais válidas chega ao dashboard", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
