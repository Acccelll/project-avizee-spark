---
name: Multi-tenant Onda 1 (Cadastros)
description: Onda 1 multi-tenant — empresas + user_empresas (1:1) + empresa_id em clientes/fornecedores/produtos com RLS por empresa
type: feature
---
# Multi-tenant — Onda 1 (28/abr/2026)

**Modelo escolhido:** 1 usuário = 1 empresa (fixo). Tabela `user_empresas` com PK em `user_id` permite migração futura para N:N sem quebrar API.

**Tabelas novas:**
- `public.empresas` (nome UNIQUE, cnpj, ativo). RLS: SELECT authenticated; INSERT/UPDATE/DELETE admin only.
- `public.user_empresas (user_id PK, empresa_id)`. Self-select + admin manage.

**Empresa default:** `"AviZee — Empresa Padrão"`. Backfill automático de todos os `auth.users` existentes.

**Helper RLS:**
```sql
public.current_empresa_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
  -- SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()
```

**Tabelas migradas nesta onda:** `clientes`, `fornecedores`, `produtos`.
- Coluna `empresa_id NOT NULL DEFAULT public.current_empresa_id()` (default torna o tipo TS opcional no Insert — código existente continua funcionando sem mudanças).
- Trigger `BEFORE INSERT set_empresa_id_default()` como safety-net (cobre seeds, edge functions sem auth.uid).
- Índice `idx_<tabela>_empresa_id`.
- RLS: `empresa_id = current_empresa_id() OR has_role(uid, 'admin')` em SELECT/INSERT/UPDATE; DELETE permanece admin-only.

**Não migrado nesta onda (continua single-tenant USING(true)):**
- financeiro_lancamentos, financeiro_baixas, compras, compras_itens, estoque_movimentos, conciliacao_bancaria, notas_fiscais, notas_fiscais_itens, orcamentos, ordens_venda, pedidos_compra.

**Próximas ondas previstas:**
- Onda 2: Comercial (orcamentos, ordens_venda) + Compras.
- Onda 3: Estoque + Logística.
- Onda 4: Financeiro + Fiscal (mais sensível — exige reescrita de RPCs salvar_nota_fiscal, fluxo_caixa views, etc).

**UI ainda pendente nesta onda:**
- Tela admin para gerenciar empresas e vínculos `user_empresas`. Hoje só é possível via SQL/insert tool.
- Indicador da empresa corrente no header/configurações.

## UI admin (28/abr/2026)

Aba **Administração → Empresa → "Empresas e vínculos"** (`?tab=empresas`):

- KPIs: total de empresas, usuários vinculados, usuários sem vínculo (alerta amber).
- CRUD de `empresas` (nome único, cnpj opcional, toggle ativo). Remoção bloqueada quando há usuários vinculados (FK RESTRICT) ou cadastros (clientes/fornecedores/produtos).
- Tabela de vínculos com Select inline para trocar a empresa do usuário; usuários sem vínculo aparecem destacados em amber.

Arquivos:
- `src/services/empresas.service.ts` (CRUD + bindings + unbound users)
- `src/pages/admin/hooks/useEmpresasAdmin.ts` (React Query)
- `src/pages/admin/sections/EmpresasSection.tsx`
- `src/pages/Administracao.tsx` (aba registrada, key `empresas`)

Aviso operacional: a troca de empresa de um usuário só passa a valer no próximo login dele (o `current_empresa_id()` é resolvido por sessão via JWT/auth.uid em SECURITY DEFINER, mas o cache de queries do cliente não é invalidado para outros usuários).
