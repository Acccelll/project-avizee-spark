
# Plano de Revisão End-to-End — AviZee ERP

Auditoria estruturada do projeto para identificar **bugs latentes, dívidas arquiteturais, riscos de segurança e oportunidades de melhoria** — sem refatorações disruptivas, respeitando a doutrina de preservação arquitetural já registrada na memória.

---

## 1. Diagnóstico atual (achados quantitativos)

| Área | Métrica | Status |
|---|---|---|
| Linter Supabase | **152 issues** | 🔴 22 ERRORS, 3 WARN extension, 127 WARN RLS "always true" |
| TypeScript | `strict:false`, `noImplicitAny:false`, `strictNullChecks:false` | 🟡 frouxo globalmente |
| Migração services | **39 páginas/hooks** ainda chamando `supabase.from/rpc` direto | 🟡 dívida vs `docs/services-migration-plan.md` |
| Testes unitários | Apenas ~5 arquivos `.test.ts` (workbook, telemetria, permissions, exemplo) | 🔴 cobertura mínima |
| Edge Functions | 16 functions, várias sem teste/log estruturado | 🟡 |
| Histórico recente | PGRST204 (schema vs service), views ignorando dados `importada/historico` | 🔴 indica drift schema↔código |

---

## 2. Eixos da revisão (5 frentes paralelas, cada uma entregável de forma independente)

### 🔒 Eixo A — Segurança & integridade do banco

**A.1. Auditar os 22 `Security Definer Views` (ERROR)**
- Listar via `pg_views` + `pg_class.relrowsecurity` e classificar:
  - **Manter SECURITY DEFINER** (vistas de relatório que precisam bypassar RLS por design) → adicionar comentário `COMMENT ON VIEW ... IS 'security definer intencional: …'` e marcar como aceito no scanner.
  - **Converter para `security_invoker=on`** → padrão para vistas de uso direto pelo client.
- Revalidar se as vistas atualizadas no último ciclo (`vw_workbook_*`) estão com o invoker correto.

**A.2. Revisar 127 RLS `USING (true)`**
- Já existe a memória `rls-single-tenant.md` (modo permissivo intencional). Validar tabela-por-tabela se ainda faz sentido (ex.: `permission_audit`, `auditoria_logs`, `apresentacao_*` deveriam ser **admin-only** ou **owner-scoped**).
- Restringir tabelas que armazenam **PII/segredos** ou **eventos sensíveis** (audit, telemetria, comentários gerenciais).

**A.3. Extensions in Public** (3 warns)
- Mover extensões (`pg_trgm`, `unaccent`, `pgmq`?) para schema dedicado quando viável.

**A.4. Drift schema ↔ código** (causa do PGRST204 recente)
- Criar um script de smoke que cruza `Database["public"]["Tables"][T]["Row"]` (do `types.ts`) com colunas usadas em cada `service.ts`.
- Documentar processo: **toda alteração de service deve ter migration prévia aprovada** (já é regra; reforçar no `services-migration-plan.md`).

---

### 🧱 Eixo B — Hardening TypeScript

**B.1. Inventário de `any` / `as any`**
- Listar top-30 arquivos com mais ocorrências e priorizar por criticidade (financeiro > fiscal > comercial > cadastros).

**B.2. Expandir `tsconfig.STRICT-core.json`**
- Adicionar próximos lotes (sugestão): `src/services/financeiro/*`, `src/services/fiscal/*`, `src/pages/financeiro/*`, `src/pages/fiscal/*`.
- Critério de saída de cada lote: `tsc -p tsconfig.STRICT-core.json` zerado.

**B.3. Remover `@ts-nocheck` residuais** (já está em 0 segundo `rg` — manter monitorado em CI).

**B.4. Tipagem das RPCs**
- Centralizar tipos de retorno de RPC em `src/types/rpc.ts` (hoje cada hook redeclara `.rpc("…")` sem assert de tipo).

---

### 🧩 Eixo C — Migração de queries para services (continuar Fase 2/3)

**C.1. Mapear as 39 páginas/hooks** que ainda usam `supabase.from/rpc`:
- Já tem services prontos para alguns (financeiro, fiscal, estoque, comercial). Outros (Clientes, Fornecedores, Funcionários, Sócios, Transportadoras, ContasBancarias) ainda são **page-level**.
- Plano:
  1. Concluir Phase 2 (cadastros): `clientes.service.ts`, `fornecedores.service.ts`, `funcionarios.service.ts`, `transportadoras.service.ts`, `contasBancarias.service.ts`.
  2. Phase 3 (dashboards/relatórios) — já parcialmente feito; faltam hooks `useDashboard*` migrarem para `dashboard.service.ts`.
- **Não** fazer refactor visual no mesmo PR (regra do `services-migration-plan.md`).

**C.2. Padronizar invalidação de cache** via `useInvalidateAfterMutation` + `INVALIDATION_KEYS` (já existe; auditar 14 mutations cross-módulo do `CONTRACTS.md` para garantir aderência).

---

### 🧪 Eixo D — Testes & observabilidade

**D.1. Cobertura mínima por módulo crítico** (vitest)
- Alvo realista: **lib puras + services com regra de negócio**.
- Lotes prioritários:
  - `src/lib/workbook/*` (já tem 1; falta `fetchWorkbookData`, `generateWorkbook`).
  - `src/services/financeiro/*` (cálculo de baixa, status efetivo).
  - `src/services/fiscal/sefaz/*` (montagem de XML, parsing de retorno — sem rede).
  - `src/lib/permissions.ts` (já tem; expandir matriz por papel).

**D.2. Smoke tests de páginas críticas** (já há `src/test/smoke/`)
- Adicionar smoke para: `Fiscal`, `WorkbookGerencial`, `ApresentacaoGerencial`, `Financeiro`.
- Verificar render sem erro com mocks mínimos do supabase client.

**D.3. Logging estruturado em Edge Functions**
- Hoje os logs são `console.log` cru. Criar helper `_shared/logger.ts` com níveis (`info|warn|error`) e correlação por `request_id`.
- Aplicar em `sefaz-proxy`, `admin-users`, `process-email-queue`, `apresentacao-cadencia-runner`.

**D.4. Métricas de runtime**
- Aproveitar `vw_admin_audit_unified` para contabilizar erros por módulo. Criar painel admin "Saúde do sistema".

---

### 🎨 Eixo E — UX, performance e acessibilidade

**E.1. Console warnings ativos**
- Corrigir `Function components cannot be given refs` em `Badge` dentro de `ApresentacaoSlidesPreview` (envolver com `React.forwardRef` ou trocar wrapper).

**E.2. Bundle / code-split**
- Verificar tamanho do chunk inicial (`npm run build`); páginas grandes (Workbook, Apresentação, Fiscal) já usam `React.lazy`? Confirmar e estender.

**E.3. Acessibilidade**
- Auditar diálogos críticos (`ApresentacaoGeracaoDialog`, `LimparDadosMigracaoButton`) com axe-core: foco inicial, `aria-describedby`, `Esc` para fechar.

**E.4. Coerência de status (memória `contrato-de-status`)**
- Varrer telas para garantir que **todos** os badges passem por `STATUS_VARIANT_MAP`. Hoje `Apresentacao*` introduziu `status_editorial` — confirmar mapeamento.

**E.5. Responsividade mobile**
- Aplicar checklist de `produto/comercial-mobile` e `produto/configuracoes-mobile` em telas que ainda não foram revisadas: `Fiscal`, `WorkbookGerencial`, `ApresentacaoGerencial`, `Financeiro`.

---

## 3. Ordem de execução sugerida (priorizada por risco × custo)

| Fase | Conteúdo | Esforço | Risco se não fizer |
|---|---|---|---|
| **1 — Segurança DB** (Eixo A.1, A.4) | Triagem dos 22 SECURITY DEFINER + script de drift schema | Médio | 🔴 Alto (vazamento de dados / quebras silenciosas como PGRST204) |
| **2 — Bugs de UX visíveis** (E.1) | forwardRef no Badge | Baixo | 🟡 Médio (warning em prod) |
| **3 — Testes de núcleo** (D.1 priorizando workbook + fiscal + financeiro) | Lote inicial de ~10 specs | Médio | 🔴 Alto (regressões silenciosas) |
| **4 — Hardening TS** (B.1, B.2 lote financeiro/fiscal) | Expandir STRICT-core | Médio | 🟡 |
| **5 — Migração services** (C.1 cadastros) | 5 services novos, sem mudança visual | Médio | 🟡 |
| **6 — RLS revision** (A.2) | Tabela a tabela, manter modo single-tenant onde aplicável | Alto | 🟡 (warns, não erros) |
| **7 — Observabilidade** (D.3, D.4) | Logger compartilhado + painel saúde | Médio | 🟢 |
| **8 — A11y + responsividade** (E.3, E.5) | Auditoria + ajustes | Médio | 🟢 |

---

## 4. Entregáveis desta revisão (após aprovação)

Para **cada fase** acima, entregamos:
1. **Migration SQL** (quando aplicável) com nomes claros (`YYYYMMDDhhmmss_<descrição>.sql`).
2. **Patches de código** focados, sem refactor visual misturado.
3. **Specs de teste** ao lado dos arquivos modificados.
4. **Atualização de memórias** (`mem://`) quando uma decisão arquitetural for tomada.
5. **Nota no PR** explicando trade-offs (especialmente em RLS/Security Definer).

---

## 5. Perguntas em aberto antes de partir para execução

1. **Prioridade de início**: começamos pela **Fase 1 (segurança DB)** ou prefere atacar primeiro os **bugs visíveis (Fase 2 + bug do `forwardRef`)** para destravar UX?
2. **Profundidade de RLS (Eixo A.2)**: confirma manter o modo **single-tenant permissivo** descrito em `mem://security/rls-single-tenant`, restringindo só tabelas sensíveis (audit, telemetria, configs)?
3. **Strict TS**: aceita expandir `tsconfig.STRICT-core` apenas em **financeiro + fiscal** neste ciclo, deixando `pages/dashboard` e `pages/comercial` para o próximo?
4. **Cobertura de testes**: quer um alvo numérico (p.ex. **services com regra de negócio = 70% statements**) ou seguimos sem meta formal, apenas adicionando specs por módulo crítico?

Após responder, execução começa pelas fases na ordem priorizada.
