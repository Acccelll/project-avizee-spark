import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures/env";
import { login } from "../fixtures/auth";

/**
 * Auditoria de acessibilidade em rotas-chave (gancho com Etapa 5.5).
 * Limitamos a violações `serious` / `critical` — ruído `minor`/`moderate`
 * será atacado em ondas dedicadas.
 */
const ROTAS = [
  "/",
  "/dashboard",
  "/financeiro",
  "/comercial/orcamentos",
  "/fiscal",
  "/configuracoes",
];

test.describe("acessibilidade — rotas-chave", () => {
  for (const rota of ROTAS) {
    test(`sem violações sérias em ${rota}`, async ({ page, env }) => {
      await login(page, { email: env.adminEmail, password: env.adminPassword });
      await page.goto(rota);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const bloqueantes = results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
      expect(bloqueantes, JSON.stringify(bloqueantes, null, 2)).toEqual([]);
    });
  }
});