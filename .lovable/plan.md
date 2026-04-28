
## Verificação da auditoria (read-only)

Antes de propor correções, cruzei cada item com o código atual e o banco. Vários itens marcados como "CRÍTICO" **já estão resolvidos** — a auditoria foi feita contra um estado anterior. O plano abaixo separa o que é dívida técnica real do que é apenas atualização de documentação.

### Itens da auditoria que JÁ estão resolvidos (apenas atualizar docs)

| # | Item | Estado real |
|---|---|---|
| 1 | RPCs `confirmar_nota_fiscal` / `estornar_nota_fiscal` ausentes | ✅ Existem no banco. `useNotaFiscalLifecycle.ts` chama `supabase.rpc("confirmar_nota_fiscal", …)`. As funções TS antigas foram removidas (comentário explícito em `fiscal.service.ts`). |
| 4 | Race condition em `quantidade_faturada` (sem `FOR UPDATE`) | ✅ `gerar_nf_de_pedido` já usa `pg_advisory_xact_lock(hashtext(p_pedido_id))` + `SELECT … FROM ordens_venda WHERE id=… FOR UPDATE` + bloqueio por `status_faturamento='faturado'`. |
| ALTA | 153 console.* em produção | 🟡 Parcial: `vite.config.ts` faz `esbuild.drop: ["console","debugger"]` em produção e `src/lib/logger.ts` existe. Mas ~25 arquivos (Orcamentos, OrcamentoForm, Estoque, Fornecedores, Funcionarios, workbookService, financeiro/estornos, financeiro/cancelamentos, freteSimulacao, etc.) ainda usam `console.*` direto em vez do logger — em dev poluem o console e em prod somem só por causa do `drop`. |

→ **Ação**: atualizar `src/services/CONTRACTS.md` (remover bullets 1 e 2 de "Decisões pendentes") e migrar os `console.*` restantes para `logger`.

### Itens reais a corrigir nesta entrega

#### 1. ErrorBoundary per-route (crashes silenciosos)

Hoje há **um único** `<ErrorBoundary>` no nível de `<Routes>` em `App.tsx`. Um erro em qualquer página derruba o app inteiro.

**Correção**: adicionar `<ErrorBoundary>` dentro do `LazyPage` wrapper já existente, de forma transparente — uma única edição em `App.tsx` (no componente `LazyPage`) cobre todas as 45+ rotas sem repetição.

```tsx
// LazyPage atual envolve children em <Suspense>; vamos compor:
const LazyPage = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  </ErrorBoundary>
);
```

Resultado: um erro em `/fiscal` mostra a tela de erro do `ErrorBoundary` (já tem botão "Recarregar" + "Voltar ao Dashboard") sem derrubar a sidebar, header ou outras rotas em background.

#### 2. Migrar `console.*` remanescentes para `logger`

Lista alvo (todos os arquivos onde `rg "^\s*console\." src/services src/pages` retornou hits):

- `src/services/workbookService.ts` (3)
- `src/services/financeiro/estornos.ts` (1)
- `src/services/financeiro/cancelamentos.ts` (1)
- `src/services/orcamentos.service.ts` (1)
- `src/services/freteSimulacao.service.ts` (1)
- `src/pages/Orcamentos.tsx`, `OrcamentoForm.tsx`, `Estoque.tsx`, `Fornecedores.tsx`, `Funcionarios.tsx`, `GruposEconomicos.tsx`, `NotFound.tsx`

Substituição mecânica: `console.error(` → `logger.error(`, `console.warn(` → `logger.warn(`. Adicionar `import { logger } from "@/lib/logger";` onde faltar.

#### 3. Tornar ExcelJS / pptxgenjs / jsPDF dinâmicos

Auditar `src/services/workbookService.ts`, `src/services/apresentacaoService.ts` e qualquer uso de `jspdf`. Onde houver `import ExcelJS from "exceljs"` no topo do arquivo, mover para dentro da função:

```ts
async function exportarWorkbook(...) {
  const ExcelJS = (await import("exceljs")).default;
  // ...
}
```

Isso retira ~3MB do chunk principal. Como as páginas que consomem já são lazy, o ganho é direto no first-load das páginas leves (Dashboard, Login).

#### 4. Atualizar `CONTRACTS.md`

Remover/marcar como ✅ as duas pendências #1 e #2 da seção "Decisões pendentes". Manter #3 (Realtime cross-módulo) como pendente real.

### Itens grandes que ficam fora desta entrega (justificativa)

São válidos, mas exigem ondas dedicadas — não cabem com qualidade na mesma mensagem que as correções acima:

- **123 `as any`** e **489 `as Type`**: requer auditoria por arquivo + ativar regra ESLint, com risco de regressão. Tratar em PR isolado.
- **39 páginas com `supabase.from()` direto**: o roteiro já existe em `docs/services-migration-plan.md`. Continuar pelas Fases 1–3 lá descritas — não combinar com refactor visual.
- **Cobertura de testes (8,6% → 25%)**: meta de sprint, não de PR.
- **Realtime cross-módulo, sunset `_legacy/`, split de `types.ts`, CI para `check:schema-drift`, budget de bundle, TTL no `syncQueue`**: cada um vira issue/PR próprio.
- **Refactor de `OrcamentoForm.tsx` (1.768 linhas)**: combinar com migração de service (Fase 1 do plano).
- **Zod nos formulários restantes**: 5 forms — onda dedicada.

## Arquivos modificados nesta entrega

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Envolver `LazyPage` com `<ErrorBoundary>` |
| `src/services/CONTRACTS.md` | Remover pendências #1 e #2 já resolvidas |
| `src/services/workbookService.ts` | `console` → `logger`; dynamic import `exceljs` |
| `src/services/apresentacaoService.ts` | dynamic import `pptxgenjs` (se aplicável) |
| `src/services/financeiro/estornos.ts` | `console` → `logger` |
| `src/services/financeiro/cancelamentos.ts` | `console` → `logger` |
| `src/services/orcamentos.service.ts` | `console` → `logger` |
| `src/services/freteSimulacao.service.ts` | `console` → `logger` |
| `src/pages/Orcamentos.tsx`, `OrcamentoForm.tsx`, `Estoque.tsx`, `Fornecedores.tsx`, `Funcionarios.tsx`, `GruposEconomicos.tsx`, `NotFound.tsx` | `console` → `logger` |

Sem migrações de banco. Sem mudança de API pública. Risco baixo.

## Resumo

Quatro entregas concretas:

1. **ErrorBoundary por rota** via wrapper `LazyPage` (cobre 45+ rotas com 1 edição).
2. **Migração de ~13 arquivos** de `console.*` para `logger`.
3. **Lazy load** de `exceljs` / `pptxgenjs` / `jspdf` (chunks dinâmicos).
4. **Atualizar `CONTRACTS.md`** removendo pendências fiscais já resolvidas no banco.

Os demais itens da auditoria (especialmente os "CRÍTICOS" #1 e #4) **já estavam resolvidos** no código atual e estão apenas refletidos incorretamente na documentação.
