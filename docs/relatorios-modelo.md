# Módulo Relatórios — Modelo Estrutural

Este documento descreve o contrato semântico que toda fonte de dados do
módulo Relatórios deve respeitar. O objetivo é eliminar heurísticas
textuais no front (substring em status/badge), preparar drill‑down real e
tornar a evolução por domínio sustentável.

## 1. Contrato unificado

`RelatorioResultado` (em `src/services/relatorios.service.ts` /
`src/types/relatorios.ts`) sempre carrega:

| Campo | Tipo | Notas |
|---|---|---|
| `title` | `string` | Título exibido no cabeçalho. |
| `subtitle` | `string` | Descrição operacional do relatório. |
| `rows` | `T[]` | Linhas tipadas por relatório. |
| `chartData` | `Array<{name,value}>` | Dados do gráfico lateral. |
| `totals` | `Record<string,number>` | Totais derivados. |
| `kpis` | `Record<string,number>` | Valores indexados por `ReportKpiDef.key`. |
| `meta` | `ReportMeta` | **NOVO** — metadados semânticos. |
| `_isQuantityReport` | `boolean` | @deprecated — usar `meta.valueNature`. |
| `_isDreReport` | `boolean` | @deprecated — usar `meta.kind === 'dre'`. |

### `ReportMeta`

```ts
type ReportKind = 'list' | 'ranking' | 'aging' | 'dre' | 'divergencias';
type ValueNature = 'monetario' | 'quantidade' | 'percentual' | 'misto';

interface ReportMeta {
  kind: ReportKind;
  valueNature: ValueNature;
  timeAxis?: { field: string; label: string; required: boolean };
  drillDownReady: boolean;
}
```

## 2. Status estruturado por linha

Linhas de relatórios com dimensão de estado expõem **dois campos canônicos
ao lado do textual** para que o front nunca precise inspecionar `.includes()`:

| Campo | Domínio | Exemplo |
|---|---|---|
| `statusKey` | `string` canônico | `'aberto'`, `'pago'`, `'vencido'`, `'parcial'` |
| `statusKind` | `'critical'\|'warning'\|'success'\|'info'\|'neutral'` | direciona variant da Badge |
| `criticidadeKind` | idem | usado em estoque/divergências |
| `faixaKind` | idem | usado no Aging |
| `classeKind` | idem | usado na Curva ABC |
| `tipoKind` | idem | movimentos de estoque |

Mapeamento central: `src/services/relatorios/lib/statusMap.ts`. Variant da
Badge: `src/lib/relatoriosBadges.ts` (`badgeVariantFromKind`).

`utils/relatorios.filtrarPorStatus` prefere `statusKey === valor` e só cai
no path antigo quando a row ainda não foi migrada.

## 3. Eixo temporal por relatório

| Relatório | `timeAxis.field` | Coluna real | Required |
|---|---|---|---|
| `estoque`, `margem_produtos`, `divergencias`, `estoque_minimo` | — | (sem período) | false |
| `movimentos_estoque` | `criacao` | `created_at` | false |
| `financeiro` | `vencimento` | `data_vencimento` | false |
| `fluxo_caixa` | `pagamento` | `data_pagamento` (fallback `data_vencimento`) | false |
| `vendas`, `vendas_cliente` | `emissao` | `data_emissao` | false |
| `compras`, `compras_fornecedor` | `criacao` | `data_compra` | false |
| `faturamento`, `curva_abc` | `emissao` | `data_emissao` | false |
| `aging` | `vencimento` | `data_vencimento` | false |
| `dre` | `competencia` | derivada (DRE) | true |

`PeriodoFilter` exibe sublabel **"Período por <label do eixo>"** lendo
`selectedMeta.timeAxis.label`.

## 4. Drill‑down — IDs ocultos nas rows

Cada relatório anexa os IDs do(s) vínculo(s) principal(is). Esses campos
não entram nas colunas visíveis (são filtrados pelo `colDefs` em
`Relatorios.tsx`) mas ficam disponíveis para `onRowClick`/exportação:

| Relatório | IDs anexados |
|---|---|
| estoque, margem_produtos, estoque_minimo, movimentos_estoque, curva_abc | `produtoId` |
| financeiro, aging | `lancamentoId`, `clienteId?`, `fornecedorId?` |
| vendas | `ordemVendaId`, `clienteId` |
| vendas_cliente | `clienteId` |
| compras | `compraId`, `fornecedorId` |
| compras_fornecedor | `fornecedorId` |
| faturamento | `notaFiscalId`, `clienteId`, `ordemVendaId` |
| divergencias | `referenciaId` + `referenciaTipo` |

`ReportDrillDownAction.targetField` indica qual ID da row usar quando a
navegação for ligada (próximo passo).

## 5. Filtros de referência escaláveis

Clientes e fornecedores deixaram de ser carregados com `limit(300)`.
`AsyncMultiSelect` (`src/components/ui/AsyncMultiSelect.tsx`) faz busca
server-side com debounce, e os carregadores ficam em
`useRelatoriosFiltrosData` (`loadClienteOptions`, `loadFornecedorOptions`,
e respectivos `*Labels` para resolver chips pré-selecionados).

## 6. Exportação semântica

`ExportOptions` recebe `resultado` (e portanto `meta`). O PDF usa
`meta.timeAxis.label` no subtítulo do período e respeita
`meta.valueNature === 'quantidade'` no formato dos totais.

## 7. Pontos de evolução futura

- DRE oficial via view contábil dedicada (hoje gerencial aproximado).
- `onRowClick` real para drill-down navegacional usando `targetField`.
- Materialização de Curva ABC e Aging para grandes volumes.
- Cache server-side por categoria com `staleTime` ajustado.