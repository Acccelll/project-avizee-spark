/**
 * Helpers de autenticação para specs E2E.
 *
 * Usam `/auth` e seletores estáveis (label/placeholder), não selectors CSS
 * frágeis. Quando MFA estiver ativo, o helper espera o passo TOTP — para o
 * usuário de teste, o secret deve estar em `E2E_ADMIN_TOTP_SECRET`.
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function login(
  page: Page,
  credentials: { email: string; password: string; totp?: string },
): Promise<void> {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(credentials.email);
  await page.getByLabel(/senha/i).fill(credentials.password);
  await page.getByRole("button", { name: /entrar/i }).click();

  if (credentials.totp) {
    await page.getByLabel(/c[óo]digo/i).fill(credentials.totp);
    await page.getByRole("button", { name: /verificar|confirmar/i }).click();
  }

  // Confirma que o app entrou em rota autenticada.
  await expect(page).toHaveURL(/^(?!.*\/auth).*/);
}

export async function logout(page: Page): Promise<void> {
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: /sair|logout/i }).click();
  await expect(page).toHaveURL(/\/auth/);
}