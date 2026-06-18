import { test, expect } from "../fixtures/env";
import { login } from "../fixtures/auth";
import path from "node:path";

test.describe("financeiro — conciliação OFX", () => {
  test("importa OFX, sugere pares e confirma conciliação", async ({
    page,
    env,
  }) => {
    await login(page, { email: env.adminEmail, password: env.adminPassword });

    await page.goto("/financeiro/conciliacao");
    await page.getByRole("button", { name: /importar.*extrato|ofx/i }).click();

    const ofxPath = path.resolve(__dirname, "../fixtures/extrato-seed.ofx");
    await page.setInputFiles('input[type="file"]', ofxPath);

    await expect(page.getByText(/transa[çc][õo]es importadas/i)).toBeVisible();
    await expect(page.getByText(/sugest[õo]es/i)).toBeVisible();

    // Confirma o primeiro par sugerido.
    await page.getByRole("button", { name: /confirmar/i }).first().click();
    await expect(page.getByText(/conciliado/i)).toBeVisible();
  });
});