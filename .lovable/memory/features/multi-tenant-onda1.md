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

**Status (após Onda 4 — 28/abr/2026):** Multi-tenant completo em todas as
tabelas de domínio. Nenhuma tabela `USING(true)` remanescente.

**Próximas ondas previstas:**
- Onda 2: Comercial (orcamentos, ordens_venda) + Compras.
- Onda 3: Estoque + Conciliação bancária. ✅ concluída 28/abr/2026.
- Onda 4: Financeiro + Fiscal. ✅ concluída 28/abr/2026.

## Onda 3 (28/abr/2026) — Estoque + Conciliação

Tabelas migradas: `estoque_movimentos`, `conciliacao_bancaria`.
- `empresa_id NOT NULL DEFAULT public.current_empresa_id()` + índice + trigger safety-net (`set_empresa_id_default`, reusada da Onda 1).
- RLS: SELECT/INSERT/UPDATE = empresa do usuário OR admin; DELETE = admin only.
- Backfill: registros existentes vinculados à empresa padrão.
- TypeScript Insert types continuam aceitando payloads sem `empresa_id` (default cobre).
- Tabelas filhas (extratos/links de conciliação) não tinham coluna empresa_id e seguem RLS atual; herdam isolamento via FK quando aplicável.

## Onda 4 (28/abr/2026) — Financeiro + Fiscal

Tabelas migradas: `financeiro_lancamentos`, `financeiro_baixas`, `notas_fiscais`.
- `notas_fiscais_itens` não recebe coluna; RLS herda via `EXISTS` na nota pai.
- `empresa_id NOT NULL DEFAULT current_empresa_id()` + índice + trigger safety-net.
- RLS financeiro: combina **papel obrigatório** (`admin` OR `financeiro`) **com filtro de empresa**.
- RLS notas_fiscais: empresa do usuário OR admin; UPDATE preserva regra de status (`autorizada`/`cancelada_sefaz`/`inutilizada` só com papel admin/financeiro).
- DELETE permanece admin-only (políticas legadas mantidas).
- Views `vw_workbook_*` e `vw_apresentacao_*` agora filtram automaticamente por tenant via `security_invoker=on` herdando RLS do chamador.
- Backfill: tudo vinculado à empresa padrão.

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

## Onda 2 — Comercial + Compras (28/abr/2026)

**Tabelas migradas (parents):** `orcamentos`, `ordens_venda`, `compras`, `pedidos_compra`.
- Mesmo padrão da Onda 1: `empresa_id NOT NULL DEFAULT current_empresa_id()`, índice, trigger BEFORE INSERT, RLS por empresa (admin enxerga tudo).

**Tabelas-filhas (`*_itens`):** `orcamentos_itens`, `ordens_venda_itens`, `compras_itens`, `pedidos_compra_itens`.
- **Não receberam coluna** — herdam empresa via `EXISTS(SELECT 1 FROM <parent> WHERE id=<fk> AND empresa_id=current_empresa_id())`.
- Garante consistência por construção: impossível ter item de empresa A apontando para documento de empresa B.

**Linter:** 404 → 380 warnings (24 USING(true) eliminados). Build TS limpo, sem mudança no frontend.

**Restantes single-tenant:** financeiro_lancamentos, financeiro_baixas, estoque_movimentos, conciliacao_bancaria, notas_fiscais, notas_fiscais_itens. Vão na Onda 3 (Estoque) e Onda 4 (Financeiro + Fiscal — mais sensível, exige reescrita de RPCs como salvar_nota_fiscal e views vw_workbook_*).
