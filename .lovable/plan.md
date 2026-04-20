

## Revisão estrutural — Módulo Relatórios

Diagnóstico real:
- O serviço já entrega `title/subtitle/rows/chartData/totals/kpis`, mas usa **duas flags ad‑hoc** (`_isQuantityReport`, `_isDreReport`) que vazam para `Relatorios.tsx` e `formatCellValue`.
- Status/badges são classificados no front por **substring genérica** (`BADGE_CRITICAL/BADGE_OK` em `Relatorios.tsx` e `filtrarPorStatus` em `utils/relatorios.ts`), com `r["status"] ?? r["situacao"] ?? r["faturamento"]` — frágil ao variar rótulo.
- O **eixo temporal** de cada relatório (emissão, vencimento, pagamento, criação, competência) é definido implicitamente dentro de cada `case`, sem aparecer no config para a UI ou para exportação.
- `drillDown` no config existe mas as rows **não trazem IDs** dos vínculos (ex.: `vendas` retorna `numero` mas não `ordem_venda_id`; `faturamento` não retorna `nota_fiscal_id`/`cliente_id`).
- `useRelatoriosFiltrosData` tem `limit(300)` em clientes/fornecedores — trunca silenciosamente.
- `relatorios.service.ts` tem 1129 linhas em um único `switch` — dificulta evolução por domínio.
- DRE/Aging/Curva ABC/Divergências têm semântica especial sem metadado explícito.

Plano corrige sem inventar sistema novo: enriquece o contrato existente, remove heurísticas, prepara drill‑down real e refatora arquivos por domínio.

---

### 1) Contrato semântico padronizado

Em `relatorios.service.ts`, estender (sem quebrar) o `RelatorioResultado`:

```ts
export type ReportKind = 'list' | 'ranking' | 'aging' | 'dre' | 'divergencias';
export type ValueNature = 'monetario' | 'quantidade' | 'percentual' | 'misto';

export interface ReportMeta {
  kind: ReportKind;
  valueNature: ValueNature;
  /** Eixo temporal aplicado: nome do campo de data + label legível */
  timeAxis?: { field: string; label: string; required: boolean };
  /** Indica se rows trazem IDs aptas a drill-down */
  drillDownReady: boolean;
}

export interface RelatorioResultado<T = Record<string, unknown>> {
  title: string; subtitle: string;
  rows: T[];
  chartData?: Array<{ name: string; value: number }>;
  totals?: Record<string, number>;
  kpis?: Record<string, number>;
  meta: ReportMeta;                     // NOVO — sempre presente
  /** @deprecated usar meta.valueNature === 'quantidade' */
  _isQuantityReport?: boolean;
  /** @deprecated usar meta.kind === 'dre' */
  _isDreReport?: boolean;
}
```

Cada `case` passa a popular `meta`. As flags antigas continuam emitidas por compatibilidade (1 sprint), mas o front passa a ler `meta`.

### 2) Status estruturado — fim do "substring textual"

Hoje o front filtra por `r["status"] ?? r["situacao"] ?? r["faturamento"]` com `.includes(...)`. Substituir por **status canônico explícito** via duas adições:

a) Em cada row de relatório que tem dimensão de status, adicionar campos novos **persistentes ao lado dos textuais**:
```ts
statusKey: string;       // 'aberto' | 'parcial' | 'pago' | ... (canônico)
statusKind: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
```
- `financeiro`: já tem `status` canônico — apenas mapear para `statusKey/statusKind` na própria service (mapa pequeno em `src/lib/relatoriosStatusMap.ts`).
- `vendas`: usa `status_comercial` + `faturamento_status` — manter labels visuais e expor `statusKey`/`statusKind` derivados das constantes já existentes em `src/lib/statusSchema.ts`.
- `compras`, `aging`, `divergencias`, `estoque`, `estoque_minimo`, `movimentos_estoque`, `curva_abc`: idem.

b) `filtrarPorStatus` em `utils/relatorios.ts` passa a comparar `r.statusKey === valor` (com fallback ao antigo path para retrocompat). `Relatorios.tsx` remove `BADGE_CRITICAL/BADGE_OK`: a variante de badge vem de `r.statusKind`.

### 3) Badges estruturadas

Novo helper `src/lib/relatoriosBadges.ts`:
```ts
export function badgeVariantFromKind(kind?: StatusKind): BadgeVariant
```
`Relatorios.tsx` usa exclusivamente `r.statusKind` / `r.criticidadeKind` quando presentes. Constantes textuais ficam apenas como **fallback** para colunas legadas, com comentário `// fallback heurístico — remover quando todos relatórios expuserem statusKind`.

Para colunas como `criticidade`, `faixa`, `classe` (ABC), o service passa a anexar `criticidadeKind` / `faixaKind` / `classeKind` ao lado.

### 4) Eixo temporal explícito por relatório

No config (`relatoriosConfig.ts`), cada `ReportConfig` ganha campo opcional:
```ts
timeAxis?: { field: 'emissao' | 'vencimento' | 'pagamento' | 'criacao' | 'competencia', 
             label: string, required: boolean }
```
Tabela canônica:

| Relatório | timeAxis.field | Coluna real | Required |
|---|---|---|---|
| estoque, margem_produtos, divergencias | — | (sem período) | false |
| estoque_minimo | — | — | false |
| movimentos_estoque | criacao | `created_at` | false |
| financeiro | vencimento | `data_vencimento` | false |
| fluxo_caixa | pagamento | `data_pagamento` (fallback `data_vencimento`) | false |
| vendas, vendas_cliente | emissao | `data_emissao` | false |
| compras, compras_fornecedor | criacao | `data_compra` | false |
| faturamento, curva_abc | emissao | `data_emissao` | false |
| aging | vencimento | `data_vencimento` | false |
| dre | competencia | derivada (DRE) | true |

`PeriodoFilter` passa a exibir um sublabel **"por <label do eixo>"** (ex.: "Período por vencimento") usando `selectedMeta.timeAxis.label`. O service já aplica em campos certos; agora isso fica visível e auditável.

### 5) Drill-down real — IDs nas rows

Para todos relatórios "list" e "ranking", o service passa a retornar IDs ocultos do vínculo principal:

| Relatório | IDs adicionados às rows |
|---|---|
| estoque, margem_produtos, estoque_minimo, movimentos_estoque | `produtoId` |
| financeiro, aging | `lancamentoId`, `clienteId?`, `fornecedorId?` |
| vendas | `ordemVendaId`, `clienteId` |
| vendas_cliente | `clienteId` |
| compras | `pedidoCompraId` (na verdade `compraId`), `fornecedorId` |
| compras_fornecedor | `fornecedorId` |
| faturamento | `notaFiscalId`, `clienteId`, `ordemVendaId` |
| curva_abc | `produtoId` |
| divergencias | `referenciaId` (uuid) + `referenciaTipo` ('pedido_compra' \| 'nota_fiscal') |

Esses campos **não entram nas colunas visíveis** (não estão em `cfg.columns`). Como `Relatorios.tsx` já filtra `colDefs` por `rowKeys`, basta adicionar os campos — o filtro mantém os IDs fora da tabela. Eles ficam disponíveis para a futura ação `onRowClick`/`drillDown` e para exportação opcional.

`ReportDrillDownAction` ganha `targetField: string` indicando qual ID da row usar para construir a navegação. Implementação completa do click → navegação fica preparada (não wired ainda) para evitar escopo demais.

### 6) Filtros de referência escaláveis

Substituir `MultiSelect` simples de clientes/fornecedores em `FiltrosRelatorio.tsx` por **busca assíncrona com debounce**:

- Novo hook `useRefSearch(table, q, ids)` em `src/pages/relatorios/hooks/useRelatoriosFiltrosData.ts`:
  - `enabled` quando `q.length >= 2` ou quando há `ids` selecionados.
  - Limit 50 por busca, sem `limit(300)` global.
  - Cache por `[table, q]` com `staleTime: 5min`.
- Mantém-se o `useRelatoriosFiltrosData` para grupos (volume baixo) e empresa.
- `MultiSelect` é trocado por `AsyncMultiSelect` (componente novo em `src/components/ui/AsyncMultiSelect.tsx`) que aceita `loadOptions(query)`. Ele já busca também os labels dos `ids` pré-selecionados via segunda query (`in('id', ids)`).

Resultado: fim da truncagem silenciosa.

### 7) DRE / Aging / Curva ABC / Divergências — metadados especiais

Cada um passa a setar `meta.kind`:
- `dre` → `kind: 'dre'`, `valueNature: 'monetario'`. `DreTable` continua sendo a renderização condicional, mas o gate vira `resultado.meta.kind === 'dre'` (sai a flag `_isDreReport`).
- `aging` → `kind: 'aging'`. UI pode mostrar legenda das faixas a partir de `meta`.
- `curva_abc` → `kind: 'list'` + `valueNature: 'monetario'`. Cada row já carrega `classeKind` para badge.
- `divergencias` → `kind: 'divergencias'`. UI passa a usar `criticidadeKind` e `tipoKind` (em vez de `BADGE_CRITICAL.includes('alta'|'pedido s/ nf'|...)`).

### 8) Exportação semântica

`ExportOptions` passa a aceitar `meta?: ReportMeta`. `buildPdfDocument` usa:
- `meta.timeAxis?.label` no subtítulo do período ("Período por vencimento: …").
- `meta.kind === 'dre'` para layout em duas colunas largas (substitui heurística pelo título).
- `meta.valueNature === 'quantidade'` para suprimir prefixo monetário no rodapé totais.

`exportColumnDefs` em `Relatorios.tsx` continua igual; o ganho é remover ifs de "se titulo contém DRE…" (não há, mas evita cair nesse padrão).

### 9) Refatoração do service por domínio

`relatorios.service.ts` (1129 linhas) é dividido mantendo a API pública intacta:

```
src/services/relatorios/
  index.ts                     // re-exporta carregarRelatorio + tipos públicos
  contracts.ts                 // RelatorioResultado, ReportMeta, FiltroRelatorio, helpers
  dispatcher.ts                // switch (tipo) → chama loaders por domínio
  domains/
    estoque.ts                 // estoque, estoque_minimo, movimentos_estoque, margem_produtos
    financeiro.ts              // financeiro, fluxo_caixa, aging, dre
    comercial.ts               // vendas, vendas_cliente, curva_abc
    compras.ts                 // compras, compras_fornecedor
    fiscal.ts                  // faturamento
    divergencias.ts            // divergencias
  lib/
    rangeQuery.ts              // withDateRange
    statusMap.ts               // mapas canônicos statusKey/statusKind por entidade
```

`src/services/relatorios.service.ts` vira **shim re-export**:
```ts
export * from './relatorios/index';
```
para não quebrar nenhum import existente (`Relatorios.tsx`, `useRelatorio.ts`, hooks, testes).

### 10) Compatibilidade

- `_isQuantityReport` e `_isDreReport` continuam preenchidos, marcados `@deprecated`. `formatCellValue` continua aceitando `isQuantityReport`. UI passa a ler `meta` mas tolera ausência (fallback ao comportamento atual).
- `filtrarPorStatus` mantém path antigo quando `statusKey` ausente.
- Testes existentes (`src/services/__tests__/relatorios.service.test.ts`, `src/utils/__tests__/relatorios.test.ts`) continuam válidos; novos casos cobrem `meta` e `statusKey`.

### Arquivos alterados / criados

Criados:
- `src/services/relatorios/{index,contracts,dispatcher}.ts`
- `src/services/relatorios/domains/{estoque,financeiro,comercial,compras,fiscal,divergencias}.ts`
- `src/services/relatorios/lib/{rangeQuery,statusMap}.ts`
- `src/lib/relatoriosBadges.ts`
- `src/components/ui/AsyncMultiSelect.tsx`

Alterados:
- `src/services/relatorios.service.ts` → shim de re-export.
- `src/types/relatorios.ts` → tipos `ReportMeta`, `ValueNature`, novas colunas opcionais (`statusKey`, `statusKind`, `criticidadeKind`, `*Id`).
- `src/config/relatoriosConfig.ts` → `timeAxis` por relatório; `drillDown[].targetField`.
- `src/pages/Relatorios.tsx` → remove `BADGE_CRITICAL/OK`, lê `statusKind`/`meta`, mostra label do eixo temporal.
- `src/pages/relatorios/components/Filtros/FiltrosRelatorio.tsx` → usa `AsyncMultiSelect` para clientes/fornecedores.
- `src/pages/relatorios/hooks/useRelatoriosFiltrosData.ts` → adiciona `useRefSearch`; remove `limit(300)` (mantém grupos).
- `src/utils/relatorios.ts` → `filtrarPorStatus` prefere `statusKey`.
- `src/services/export.service.ts` → aceita `meta`, usa `timeAxis.label` no PDF.
- `src/pages/relatorios/components/Tabelas/DreTable.tsx` → gate vira `meta.kind === 'dre'`.
- Documentação: `docs/relatorios-modelo.md` (novo) com tabela de eixo temporal, mapa `statusKey/statusKind`, contratos `ReportMeta` e drill‑down.

### Estratégias declaradas

- **Status estruturado**: campos `statusKey` + `statusKind` por row, mapa central em `relatorios/lib/statusMap.ts`. Filtro e badge não dependem mais de label.
- **Badges**: variant vem de `*Kind`; constantes textuais permanecem só como fallback.
- **Eixo temporal**: declarado em `ReportConfig.timeAxis` e refletido em `meta.timeAxis`; UI exibe sublabel.
- **Drill-down**: rows carregam `*Id` ocultos; `drillDown[].targetField` aponta o ID a usar; navegação fica plug-and-play em fase posterior.
- **Filtros de referência**: busca assíncrona com debounce, sem truncagem.

### Pontos para evolução futura (fora deste escopo)

- DRE oficial via view contábil dedicada (hoje gerencial aproximado).
- Wire real do `onRowClick` para drill-down navegacional.
- Materialização (view) de Curva ABC e Aging para grandes volumes.
- Cache server-side de relatórios com `staleTime` maior por categoria.

