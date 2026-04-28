# Auditoria — onda de correções priorizada

A auditoria que você passou tem itens já resolvidos pelas Ondas 1-6 (Logística já tem `src/services/logistica/` com `remessas`/`recebimentos`/`lookups`; `Fiscal.tsx` e `Orcamentos.tsx` não acessam mais Supabase direto — chamam `upsertNotaFiscalComItens` e `duplicateOrcamento`). O risco real está **dentro dos services** e em alguns pontos de infraestrutura. Abaixo o plano para o que de fato precisa de correção, agrupado por bloco entregável.

## Bloco 1 — Críticos de segurança e atomicidade

### 1.1 `vite.config.ts`: remover fallbacks hardcoded
- Remover `FALLBACK_SUPABASE_URL`, `FALLBACK_SUPABASE_PUBLISHABLE_KEY`, `FALLBACK_SUPABASE_PROJECT_ID` e `FALLBACK_APP_URL`.
- O bloco `define` passa a usar apenas `process.env.VITE_*`; quando ausente, injeta `undefined` (string `"undefined"` no bundle), e `isSupabaseConfigured` em `src/integrations/supabase/client.ts` já cobre o caso com mensagem clara.
- Atualizar `.env.example` listando as 4 variáveis como obrigatórias.
- Como o build do preview Lovable já provê essas envs automaticamente, isto não quebra o ambiente atual; apenas elimina o vínculo de fork ao endpoint de produção.

### 1.2 RPC `salvar_nota_fiscal` (Fiscal — atomicidade)
- Migração SQL criando `public.salvar_nota_fiscal(p_nf_id uuid, p_payload jsonb, p_itens jsonb) returns uuid` com `SECURITY DEFINER`, `SET search_path = public` (regra core do projeto).
- Lógica em transação única:
  1. Se `p_nf_id` é nulo → `INSERT` em `notas_fiscais` retornando `id`; senão `UPDATE`.
  2. `DELETE` de `notas_fiscais_itens WHERE nota_fiscal_id = id`.
  3. `INSERT` em massa dos itens a partir do JSONB.
- Refatorar `upsertNotaFiscalComItens` em `src/services/fiscal.service.ts` para uma única chamada `supabase.rpc('salvar_nota_fiscal', ...)`. Remover os 3 round-trips atuais (linhas 175-196).
- Tipagem via `src/types/rpc.ts` (`callRpc`) seguindo o padrão já estabelecido.

### 1.3 RPC `duplicar_orcamento` (Orçamentos — atomicidade)
- Migração SQL criando `public.duplicar_orcamento(p_orcamento_id uuid) returns jsonb` (`{ id, numero }`) com `SECURITY DEFINER`, `search_path = public`.
- Internamente usa a sequence/RPC `proximo_numero_orcamento` já existente, copia cabeçalho como `rascunho` e replica os itens em uma transação.
- Refatorar `duplicateOrcamento` em `src/services/orcamentos.service.ts` para uma única chamada de RPC (substituindo os 4 passos atuais nas linhas 175-240).

## Bloco 2 — Robustez de fetch e CI

### 2.1 `useSupabaseCrud`: propagar `AbortSignal` no loop chunked
- React Query 5 entrega `signal` em `queryFn`. Hoje o hook ignora.
- Mudanças em `src/hooks/useSupabaseCrud.ts`:
  - Receber `{ signal }` no `queryFn`.
  - Encadear `.abortSignal(signal)` em `buildQuery()` (suportado pelo Supabase JS v2 PostgREST builder) tanto no modo `paged` quanto no loop `all`.
  - Sair do `while (true)` quando `signal.aborted` for true, sem `setState`.
- Sem mudança na API pública do hook.

### 2.2 GitHub Actions — pipeline mínimo
- Criar `.github/workflows/ci.yml` com jobs em paralelo:
  - `typecheck` → `npm run typecheck:core` (config strict já existe em `tsconfig.strict-core.json`).
  - `lint` → `npm run lint`.
  - `test` → `npx vitest run`.
  - `schema-drift` → `node scripts/check-schema-drift.mjs`.
- `lint:touch-targets` fica como step não-bloqueante (`continue-on-error: true`).
- Trigger: `pull_request` + `push` em `main`.
- Sem secrets necessários (testes não tocam Supabase real; schema-drift usa snapshot local).

## Itens deliberadamente fora desta entrega

Para manter a onda focada e revisável, **não** incluo agora:
- Migração de forms para Zod (Bloco MÉDIA) — entrega separada por módulo.
- Auditoria das 32 supressões de `exhaustive-deps` (MÉDIA) — varredura própria.
- Dynamic imports de ExcelJS/pptxgenjs (FUTURA) — ganho marginal, requer benchmark.
- `PeriodFilter direction`, `MonthFilter`, `rowExtraActions`, Budget vs Realizado, Notificações proativas, PWA, Webhooks de saída, Multi-tenant — são features/refactors maiores já documentados em `.lovable/plan.md` e merecem ondas próprias.

Se quiser, depois desta onda eu abro a próxima já com 1-2 desses itens combinados (sugiro `PeriodFilter direction` + `rowExtraActions` por terem spec pronta no `plan.md`).

## Resumo técnico de arquivos tocados

```text
vite.config.ts                                  (remover fallbacks)
.env.example                                    (4 envs obrigatórias)
supabase/migrations/<ts>_salvar_nota_fiscal.sql (nova RPC)
supabase/migrations/<ts>_duplicar_orcamento.sql (nova RPC)
src/services/fiscal.service.ts                  (usar RPC)
src/services/orcamentos.service.ts              (usar RPC)
src/hooks/useSupabaseCrud.ts                    (AbortSignal)
.github/workflows/ci.yml                        (novo)
```

## Verificação pós-implementação

- Editar uma NF existente removendo itens e salvando → confirmar que o cabeçalho e itens permanecem consistentes mesmo se a chamada for interrompida.
- Duplicar orçamento → checar `numero` sequencial e itens copiados; em falha simulada, nenhum cabeçalho órfão fica no banco.
- Trocar filtro rapidamente em uma listagem grande (`paginationMode: 'all'`) → confirmar nos devtools que requests pendentes são canceladas.
- Abrir PR no GitHub → confirmar que os 4 jobs do CI executam.

Aprova para eu executar este plano?

---

## Onda complementar — verificação `PeriodFilter direction` + `rowExtraActions` (28/abr/2026)

Antes de iniciar mudanças, varredura confirmou que ambos os itens **já estão implementados e adotados**:

- `PeriodFilter` expõe `direction?: 'past' | 'future' | 'neutral'` (default `past`), com chips,
  ícones (`History`/`CalendarClock`/`Calendar`) e tooltips específicos por direção.
  - `direction="future"` em uso: `Financeiro.tsx`, `FluxoCaixa.tsx`, `MonthFilter` em `Financeiro`.
  - `direction="past"` (explícito) em uso: `Pedidos.tsx`, `Orcamentos.tsx`, `Conciliacao.tsx`, `Estoque.tsx`.
  - `Auditoria.tsx` usa default (`past`), apropriado para log histórico.
- `DataTable.rowExtraActions?: (item) => ReactNode` (linha 168 de `src/components/DataTable.tsx`)
  já consumido em: `Orcamentos`, `Logistica` (entregas + recebimentos), `compras/PedidoCompraTable`,
  `Financeiro`, `Pedidos`.

Sem gap funcional → nenhuma alteração de código necessária nesta onda. Próxima frente sugerida:
migração de forms para Zod (NF, Orçamento, Cliente) ou multi-tenant `empresa_id`.

---

## Onda — Dynamic imports ExcelJS / pptxgenjs (28/abr/2026)

Objetivo: tirar as duas libs mais pesadas do bundle inicial. Cada uma só é necessária quando o usuário aciona uma ação explícita (gerar workbook, gerar apresentação, importar planilha).

- `src/services/workbookService.ts`: removido `import { generateWorkbook }` estático;
  introduzido helper `loadGenerateWorkbook()` com `await import('@/lib/workbook/generateWorkbook')`.
  Toda a árvore `src/lib/workbook/*` (que importa `exceljs`) passa a virar um chunk separado
  via code-splitting do Vite/Rollup.
- `src/services/apresentacaoService.ts`: import de `generatePresentation` virou `import type` +
  helper `loadGeneratePresentation()` com `await import('@/lib/apresentacao/generatePresentation')`.
  `pptxgenjs` (~250KB) sai do bundle inicial.
- `src/lib/xlsx-compat.ts`: ExcelJS agora carregado via `loadExcelJS()` (cached promise) em vez
  de `import ExcelJS from "exceljs"` no topo. `read()` continua síncrona (já retornava workbook
  com `_loaded` promise — consumidores já chamam `await ensureLoaded(wb)`). `utils.book_new` e
  `utils.json_to_sheet` viraram `async` (sem consumidores ativos — verificado).
- `src/services/export.service.ts` já usava `await import("exceljs")` desde o Bloco 1.

Resultado esperado: três chunks lazy distintos — `chunk-workbook.*.js` (ExcelJS + planilhas
gerenciais), `chunk-apresentacao.*.js` (pptxgenjs), `chunk-exceljs.*.js` (compartilhado entre
xlsx-compat e export.service). Bundle inicial deixa de carregar ~650KB de libs Office.

Sem mudança na API pública dos services consumidos por componentes/páginas.

---

## Onda — Auditoria Zod nos formulários (28/abr/2026)

Antes de iniciar mudanças, varredura confirmou que **todos os formulários
críticos já validam com Zod**. Não há código a alterar nesta onda.

| Formulário | Schema | Mecanismo |
|---|---|---|
| NF-e (`pages/fiscal/components/NFeForm`) | `nfeSchema` (com `superRefine` p/ CFOP e parcelas) | `zodResolver` + react-hook-form |
| Orçamento (`pages/OrcamentoForm.tsx`) | `orcamentoSchema` | `zodResolver` + react-hook-form |
| Pedido de Compra (`hooks/usePedidosCompra.ts`) | `pedidoCompraSchema` + `validatePedidoItems` | `validateForm()` helper |
| Cotação de Compra (`hooks/useCotacoesCompra.ts`) | `cotacaoCompraSchema` + `validateCotacaoItems` | `validateForm()` helper |
| Cliente (`pages/Clientes.tsx`) | `clienteFornecedorSchema` | `validateForm()` helper |
| Fornecedor (`pages/Fornecedores.tsx`) | `clienteFornecedorSchema` | `validateForm()` helper |
| Produto (`pages/Produtos.tsx`) | `produtoSchema` (com `extend` p/ insumo) | `validateForm()` helper |
| Transportadora (`pages/Transportadoras.tsx`) | `transportadoraSchema` | `validateForm()` helper |
| Configuração Fiscal / SPED | schemas próprios | `zodResolver` |

Convivem dois padrões válidos: `zodResolver` (forms grandes com
react-hook-form) e `validateForm()` helper (forms imperativos com `useState`).
Ambos retornam erros por campo — não há divergência funcional. Decisão: manter
os dois padrões; não vale o risco de refatorar `Clientes/Fornecedores/Produtos`
para react-hook-form sem ganho de UX correspondente.

Próximas frentes candidatas: **Painel de saúde do sistema** (admin),
**Multi-tenant `empresa_id` + RLS** ou **Notificações proativas (email queue
+ in-app badges)**.
