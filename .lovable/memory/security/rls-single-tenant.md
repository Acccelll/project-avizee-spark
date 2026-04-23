---
name: RLS Single-Tenant
description: Sistema opera em modo single-tenant — RLS permissiva para authenticated em tabelas de domínio, exceto app_configuracoes que exige admin
type: constraint
---
# RLS — Modo single-tenant

**Estado atual.** Estas tabelas têm RLS habilitado mas com políticas
`USING (true)` para `authenticated` (qualquer usuário logado lê/escreve tudo):

- `financeiro_lancamentos`, `financeiro_baixas`
- `clientes`, `fornecedores`
- `compras`, `compras_itens`
- `estoque_movimentos`
- `conciliacao_bancaria`
- `notas_fiscais`, `notas_fiscais_itens`

Cada uma delas carrega `COMMENT ON TABLE` documentando o modo single-tenant.

**Exceção: `app_configuracoes`.** Leitura, INSERT e UPDATE exigem
`public.has_role(auth.uid(), 'admin')`. Nunca relaxar isso.

## Antes de ativar multi-tenant

1. Adicionar `empresa_id uuid NOT NULL` em todas as tabelas listadas.
2. Trigger `BEFORE INSERT` popula a coluna a partir de `user_roles.empresa_id`
   (ou `current_setting('app.empresa_id')`).
3. Substituir `USING (true)` por `USING (empresa_id = ...)` em SELECT/UPDATE/DELETE.
4. Reescrever views (`vw_workbook_*`) e RPCs (`proximo_numero_*`, `salvar_*`)
   para propagar o filtro.
5. Atualizar o `useAppConfig` se a configuração passar a ser por empresa.

## Credenciais

- `VITE_SUPABASE_PUBLISHABLE_KEY` é a anon key — pública por design.
- Secrets reais (service_role, senhas SMTP, certificados PFX) **só** em
  Edge Functions via `Deno.env.get()` ou Supabase Vault.
- `.env` está no `.gitignore`. Se já houver commit, rode `git rm --cached .env`
  e rotacione a anon key no Dashboard.