/**
 * Fixture de ambiente para os specs E2E.
 *
 * O ambiente alvo precisa de:
 *  - Banco com seed determinístico (clientes/produtos/títulos previsíveis).
 *  - Usuários de teste pré-cadastrados (ver `E2E_USER_*` abaixo).
 *  - SEFAZ em homologação — emissões reais ficam bloqueadas.
 *
 * Enquanto `E2E_BASE_URL` não estiver definido (ou estiver apontando para
 * o preview local sem seed), os specs chamam `requireEnv()` no `beforeAll`
 * e se auto-pulam com `test.skip()`, mantendo a suíte verde no CI.
 */

import { test as base } from "@playwright/test";

export interface E2EEnv {
  baseUrl: string;
  adminEmail: string;
  adminPassword: string;
  vendedorEmail: string;
  vendedorPassword: string;
  /** Marca se o ambiente está pronto (todas as envs presentes). */
  ready: boolean;
  /** Motivo legível quando não está pronto — usado em `test.skip(reason)`. */
  skipReason?: string;
}

export function readEnv(): E2EEnv {
  const baseUrl = process.env.E2E_BASE_URL ?? "";
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
  const vendedorEmail = process.env.E2E_VENDEDOR_EMAIL ?? "";
  const vendedorPassword = process.env.E2E_VENDEDOR_PASSWORD ?? "";

  const missing: string[] = [];
  if (!baseUrl) missing.push("E2E_BASE_URL");
  if (!adminEmail) missing.push("E2E_ADMIN_EMAIL");
  if (!adminPassword) missing.push("E2E_ADMIN_PASSWORD");

  return {
    baseUrl,
    adminEmail,
    adminPassword,
    vendedorEmail,
    vendedorPassword,
    ready: missing.length === 0,
    skipReason: missing.length
      ? `Ambiente E2E não configurado — defina: ${missing.join(", ")}`
      : undefined,
  };
}

/**
 * Test fixture estendida que disponibiliza `env` e pula automaticamente
 * o spec quando o ambiente não está pronto. Use:
 *
 *   import { test } from "../fixtures/env";
 *   test("…", async ({ page, env }) => { … });
 */
export const test = base.extend<{ env: E2EEnv }>({
  env: async (_fixtures, applyEnv, testInfo) => {
    const env = readEnv();
    testInfo.skip(!env.ready, env.skipReason ?? "ambiente E2E indisponível");
    await applyEnv(env);
  },
});

export { expect } from "@playwright/test";