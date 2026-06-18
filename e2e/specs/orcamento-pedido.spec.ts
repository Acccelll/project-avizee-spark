import { test, expect } from "../fixtures/env";
import { login } from "../fixtures/auth";

/**
 * Fluxo: criar orçamento → aprovar → converter em pedido.
 * Depende de cliente e produto seeds (ver `e2e/fixtures/env.ts`).
 */
test.describe("comercial — orçamento → pedido", () => {
  test("cria orçamento, aprova e gera pedido vinculado", async ({
    page,
    env,
  }) => {
    await login(page, { email: env.adminEmail, password: env.adminPassword });

    await page.goto("/orcamentos/novo");
    await page.getByLabel(/cliente/i).click();
    await page.getByRole("option").first().click();

    await page.getByRole("button", { name: /adicionar item/i }).click();
    await page.getByLabel(/produto/i).click();
    await page.getByRole("option").first().click();
    await page.getByLabel(/quantidade/i).fill("2");

    await page.getByRole("button", { name: /salvar|gravar/i }).click();
    await expect(page.getByText(/or[çc]amento.*salv/i)).toBeVisible();

    await page.getByRole("button", { name: /aprovar/i }).click();
    await page.getByRole("button", { name: /confirmar/i }).click();

    await page.getByRole("button", { name: /gerar pedido|converter/i }).click();
    await expect(page).toHaveURL(/\/pedidos\//);
  });
});