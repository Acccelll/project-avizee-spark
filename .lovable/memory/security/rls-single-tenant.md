---
name: RLS Single-Tenant
description: Sistema opera em modo single-tenant — RLS permissiva para authenticated em tabelas de domínio, exceto app_configuracoes que exige admin
type: constraint
---
# RLS — Modo single-tenant

**Estado atual (28/abr/2026).** Após Ondas 1–3 do multi-tenant, restam
single-tenant `USING (true)` apenas:

- `financeiro_lancamentos`, `financeiro_baixas`
- `notas_fiscais`, `notas_fiscais_itens`

Já migradas para `empresa_id = public.current_empresa_id()`:
- Onda 1: `clientes`, `fornecedores`, `produtos`.
- Onda 2: `orcamentos`, `ordens_venda`, `compras`, `compras_itens`, `pedidos_compra`.
- Onda 3: `estoque_movimentos`, `conciliacao_bancaria`.

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