
# Plano de execução — §6 completo (Lovable + Copilot)

Objetivo: fechar os pontos residuais da review mantendo o sistema **single-tenant** e sem regressões de fluxo. Execução em 3 fases, cada uma entregável e validável de forma independente.

---

## Fase 1 — Endurecimento de backend (Lovable / DB / Edge)

### 1.1 RLS por role nas tabelas sensíveis (§4.1)
Substituir `USING (true)` por policies baseadas em `public.has_role()`, mantendo single-tenant (sem `empresa_id` ainda).

Tabelas e regras-alvo:

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `financeiro_lancamentos` | `admin` ∨ `financeiro` | `admin` ∨ `financeiro` |
| `financeiro_baixas` | `admin` ∨ `financeiro` | `admin` ∨ `financeiro` |
| `financeiro_recorrencias` | `admin` ∨ `financeiro` | `admin` ∨ `financeiro` |
| `notas_fiscais`, `notas_fiscais_itens` | `authenticated` (consulta operacional) | `admin` ∨ `financeiro` (preservar regra de status já existente) |
| `compras`, `compras_itens` | `authenticated` | `admin` ∨ `financeiro` ∨ `estoquista` |
| `estoque_movimentos` | `authenticated` | `admin` ∨ `estoquista` |
| `conciliacao_bancaria`, `conciliacao_pares` | `admin` ∨ `financeiro` | `admin` ∨ `financeiro` |

Entregáveis:
- 1 migration por área (financeiro / fiscal / compras+estoque / conciliação) para revisão isolada.
- Atualizar `COMMENT ON TABLE` documentando a nova regra.
- Atualizar `.lovable/memory/security/rls-single-tenant.md` removendo a frase "RLS permissiva para authenticated".
- Smoke pgTAP: 1 teste por área garantindo que role `estoquista` **não** lê `financeiro_lancamentos` e que `vendedor` **não** escreve em `estoque_movimentos`.

Risco controlado: edge functions de cron/admin já usam `service_role` (bypassa RLS), então não regridem.

### 1.2 SEFAZ_C14N_REAL como default (§4.6)
- Inverter o default em `supabase/functions/_shared/xml-c14n.ts`: usar C14N real salvo `SEFAZ_C14N_LEGACY=true` (opt-in inverso e temporário).
- Janela de validação: 1 emissão real de homologação documentada no `mem/features/c14n-sefaz.md`.
- Após validação, remover o fallback legado em PR separado (não nesta fase).

### 1.3 Squash de migrations — Fase A apenas (§4.5)
- Gerar `supabase/migrations/_baseline_<data>.sql.reference` via `pg_dump --schema-only --no-owner --no-privileges` (script já previsto em `docs/migrations-squash-plan.md`).
- Rodar `scripts/check-schema-drift.mjs` e versionar o resultado.
- **Não** executar Fase B/C. Apenas atualizar o plano com a data do baseline.

---

## Fase 2 — Refactors React/TS (Copilot/Codex)

### 2.1 Extrair queries diretas dos monólitos (§4.2)
Ordem de ataque (maior risco primeiro):

1. `Fiscal.tsx` (1.934 linhas) → mover queries para `services/fiscal/*.service.ts` já existentes; quebrar em `FiscalTabsContainer` + `FiscalListPanel` + `FiscalKpis`.
2. `OrcamentoForm.tsx` (2.096) → `services/orcamento.service.ts` (extensão); extrair `OrcamentoItensSection`, `OrcamentoTotaisSection`, `OrcamentoClienteSection`.
3. `EmitirNFeWizard.tsx` (1.718) → consolidar em `services/fiscal/emissao.service.ts`; etapas viram steps isolados.
4. `Conciliacao.tsx` (1.455) → `services/conciliacao.service.ts`.
5. `ProdutoForm.tsx`, `Clientes.tsx`, `Financeiro.tsx`, `Pedidos.tsx` → mesmo padrão.

Regras:
- Zero `supabase.from/rpc/storage` novos fora de `src/services/` (já é regra do `mem/`).
- Cada arquivo refatorado deve perder linhas líquidas; meta: nenhum > 800 linhas ao final.
- Sem mudança de comportamento de UI — refactor puro, validado por smoke tests existentes + screenshot manual.

### 2.2 `useSupabaseCrud`: default `paged` (§4.3)
- Inverter default: se `pageSize` não for passado, log de warning em dev e usar `pageSize=50` automático.
- Auditar usos atuais (rg `useSupabaseCrud(`) e marcar explicitamente `paginationMode: 'all'` onde o chamador realmente quer (cadastros pequenos: `unidades_medida`, `bancos`, `centros_custo`, `formas_pagamento`).
- Proibir `paginationMode: 'all'` em tabelas transacionais via comentário + entrada em `mem/`.

### 2.3 Sincronizar README (§4.4)
- Remover seção "Dívida Técnica → @ts-nocheck remanescentes" (zero hoje).
- Atualizar "Próximos passos" para refletir Fase 1/2 deste plano.
- Atualizar a seção "Segurança / RLS" com as policies por role da Fase 1.1.

---

## Fase 3 — Validação e fecho

- Rodar suite vitest + pgTAP completa.
- `supabase--linter` sem novos alertas.
- Smoke manual: login como `estoquista`, abrir DevTools, tentar `supabase.from('financeiro_lancamentos').select()` → deve falhar com RLS (prova do §1.1).
- Atualizar `mem/index.md` com referências às novas decisões.

---

## Detalhes técnicos relevantes

```text
Ordem das migrations da Fase 1.1 (cada uma é um arquivo):
  1) rls-financeiro-por-role.sql
  2) rls-fiscal-por-role.sql      (preserva regra de status já existente)
  3) rls-compras-estoque-por-role.sql
  4) rls-conciliacao-por-role.sql
```

Para cada policy substituída:
```sql
DROP POLICY <nome_antigo> ON public.<tabela>;
CREATE POLICY <nome_novo> ON public.<tabela>
  FOR <op> TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'<role>'))
  WITH CHECK (...);
COMMENT ON TABLE public.<tabela> IS '... single-tenant; acesso restrito a role X+admin';
```

Edge functions (`service_role`) continuam funcionando — RLS é bypassada por design.

---

## O que **não** está neste plano (por decisão)

- Multi-tenant (`empresa_id`) — fica para quando houver 2ª empresa real.
- Fase B/C do squash — gatilho é cair para ≤2 migrations/dia.
- Remoção definitiva do C14N legado — PR separado após validação em produção.
- Aumento de cobertura de testes além dos smokes da Fase 1.1.
