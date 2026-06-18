import { test, expect } from "../fixtures/env";
import { login } from "../fixtures/auth";

/**
 * Emissão de NF-e em homologação SEFAZ.
 * O ambiente alvo deve estar configurado com certificado A1 de teste e
 * `tpAmb=2` (homologação) — emissões reais ficam bloqueadas.
 */
test.describe("fiscal — NF-e homologação", () => {
  test("emite NF-e a partir de pedido aprovado", async ({ page, env }) => {
    await login(page, { email: env.adminEmail, password: env.adminPassword });

    await page.goto("/faturamento/emitir-nfe");
    await page.getByLabel(/cliente/i).click();
    await page.getByRole("option").first().click();

    // Avança o wizard preenchendo defaults a cada passo.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /pr[óo]ximo|continuar/i }).click();
    }

    await page.getByRole("button", { name: /emitir|transmitir/i }).click();
    await expect(page.getByText(/autorizada|sefaz/i)).toBeVisible({
      timeout: 30_000,
    });
  });
});