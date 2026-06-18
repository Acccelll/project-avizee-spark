import { test, expect } from "../fixtures/env";
import { login } from "../fixtures/auth";

test.describe("autenticação", () => {
  test("login com credenciais válidas leva ao dashboard", async ({
    page,
    env,
  }) => {
    await login(page, { email: env.adminEmail, password: env.adminPassword });
    await expect(page).toHaveURL(/\/(dashboard|inicio|home)?$/);
  });

  test("login com senha errada permanece em /auth e mostra erro", async ({
    page,
    env,
  }) => {
    await page.goto("/auth");
    await page.getByLabel(/e-?mail/i).fill(env.adminEmail);
    await page.getByLabel(/senha/i).fill("senha-invalida-xyz");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText(/credenciais|inv[áa]lid/i)).toBeVisible();
  });
});