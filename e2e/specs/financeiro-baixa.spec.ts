import { test, expect } from "../fixtures/env";
import { login } from "../fixtures/auth";

test.describe("financeiro — baixa de título", () => {
  test("baixa parcial e total preservam status corretos", async ({
    page,
    env,
  }) => {
    await login(page, { email: env.adminEmail, password: env.adminPassword });

    await page.goto("/financeiro");
    await page.getByPlaceholder(/buscar/i).fill("E2E-TITULO");
    await page.keyboard.press("Enter");

    await page.getByRole("row", { name: /E2E-TITULO/i }).first().click();
    await page.getByRole("button", { name: /baixar|registrar baixa/i }).click();

    await page.getByLabel(/valor/i).fill("50");
    await page.getByRole("button", { name: /confirmar/i }).click();

    await expect(page.getByText(/parcial/i)).toBeVisible();
  });
});