import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração de E2E (Etapa 7.3 do roadmap).
 *
 * Convenções:
 *  - Specs vivem em `e2e/specs/**`.
 *  - `E2E_BASE_URL` aponta para o ambiente de preview com seed determinístico
 *    (ainda não disponível em produção: ver fixture `e2e/fixtures/env.ts`).
 *  - Quando `E2E_BASE_URL` não está definido, todos os specs são `.skip`
 *    automaticamente — o pipeline continua verde até o ambiente existir.
 *  - Para rodar localmente contra `vite dev`:
 *      E2E_BASE_URL=http://localhost:8080 npx playwright test
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});