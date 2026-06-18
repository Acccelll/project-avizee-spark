# E2E (Playwright)

Specs em `e2e/specs/**` rodam contra um ambiente real com seed
determinístico. Enquanto o ambiente não está provisionado, todos os
testes se auto-pulam (`testInfo.skip(...)`) e o pipeline continua verde.

## Variáveis de ambiente necessárias

| Var                          | Obrigatório | Descrição                                       |
| ---------------------------- | ----------- | ----------------------------------------------- |
| `E2E_BASE_URL`               | sim         | URL do ambiente alvo (preview com seed).        |
| `E2E_ADMIN_EMAIL`            | sim         | Usuário admin de teste.                         |
| `E2E_ADMIN_PASSWORD`         | sim         | Senha do admin.                                 |
| `E2E_ADMIN_TOTP_SECRET`      | opcional    | Secret TOTP quando MFA estiver ativo.           |
| `E2E_VENDEDOR_EMAIL/PASSWORD`| opcional    | Cenários de papel `vendedor`.                   |

## Como rodar localmente

```bash
# 1. instalar browsers (primeira vez)
npx playwright install --with-deps chromium

# 2. subir o app (em outro terminal)
npm run dev

# 3. exportar credenciais e rodar
export E2E_BASE_URL=http://localhost:8080
export E2E_ADMIN_EMAIL=admin@teste.local
export E2E_ADMIN_PASSWORD='trocar'
npm run test:e2e
```

Relatório HTML cai em `playwright-report/`.

## Fixtures

- `fixtures/env.ts` — fixture `test` estendida que injeta `env` e pula
  o spec quando as envs estão ausentes.
- `fixtures/auth.ts` — helpers `login()` / `logout()` que usam
  seletores acessíveis (label/role), não CSS frágil.
- `fixtures/extrato-seed.ofx` — arquivo OFX determinístico para o
  spec de conciliação. **Pendente**: ainda não commitado; gerar a
  partir do seed do banco antes de promover o spec a obrigatório.

## Pendências para promover a bloqueante no CI

1. Provisionar ambiente de preview com seed determinístico.
2. Cadastrar usuários de teste e armazenar credenciais em GitHub
   Secrets (`E2E_ADMIN_*`).
3. Commitar `fixtures/extrato-seed.ofx` (ou gerar dinamicamente via RPC).
4. Verificar que SEFAZ aceita o certificado A1 do tenant de teste em
   `tpAmb=2`.
5. Remover `continue-on-error: true` do job `e2e` em `.github/workflows/ci.yml`.