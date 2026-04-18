

# Diagnóstico técnico — Relatórios, Exportações e Impressão

## Inventário dos pontos de exportação

| Local | CSV | Excel | PDF | Service usado |
|---|---|---|---|---|
| `Relatorios.tsx` (módulo central) | ✓ | ✓ | ✓ | `services/export.service.ts` (config-aware) |
| `DataTable.tsx` (toolbar genérica) | ✓ | ✓ | ✓ | inline (XLSX direto + jsPDF cru) |
| `Conciliacao.tsx` | — | ✓ | — | `export.service` |
| `FluxoCaixa.tsx` | — | ✓ | — | `export.service` |
| `useFinanceiroActions` | — | ✓ | ✓ | `export.service` |
| `admin/Logs.tsx` | — | ✓ | ✓ | `export.service` |
| `Social.tsx` | ✓ | ✓ | — | `social.service.ts` (paralelo) |
| `OrcamentoForm.tsx` | — | — | ✓ | `html2canvas + jsPDF` (PDF visual) |
| `WorkbookGerencial.tsx` | — | ✓ | — | `workbookService` (template-first) |
| `relatorios.service.ts` linhas 1086-1138 | ✓ | ✓ | — | **dead code** (sem callers) |

Coexistem **3 implementações distintas de exportação** (export.service, DataTable inline, social.service) + 2 helpers mortos. Sem norma única.

## Problemas reais

### A. Filtros & parâmetros

#### A1. `tiposFinanceiros` ignora arrays vazios diferente entre relatórios
- `case "financeiro"`: `if (filtros.tiposFinanceiros)` — array vazio entra no `.in()` e quebra (Supabase retorna 0 linhas).
- `case "fluxo_caixa"`: `if (filtros.tiposFinanceiros?.length)` — correto.
- Em `Relatorios.tsx:118`, o estado já normaliza para `undefined` quando vazio, então hoje não dá bug. Mas a inconsistência fica no service e quebra qualquer caller futuro.

#### A2. `clienteIds`/`fornecedorIds`/`grupoProdutoIds` mesma armadilha
Em `relatorios.service.ts` várias branches usam `if (filtros.X)` em vez de `if (filtros.X?.length)`. Ex.: linhas 166, 223, 283, 413, 461. Se o caller passar `[]`, retorna 0 linhas silenciosamente.

#### A3. Subquery N+1 em `movimentos_estoque` (linha 223-225)
```ts
if (filtros.grupoProdutoIds) query = query.in('produto_id', (
  await supabase.from('produtos').select('id').in('grupo_id', filtros.grupoProdutoIds)
).data?.map(p => p.id) || []);
```
- Roda **antes** do query principal (`await` no meio do `.in()`).
- Se a lista de produtos for >1000, o filtro retorna parcial (limite default Supabase). Sem `.limit(10000)`.
- Quando dá erro, devolve `[]` → query principal vira `produto_id IN ()` → 0 resultados sem aviso.

#### A4. `tiposFinanceiros` falha silenciosa pós-filter
Em `case "financeiro"` (linha 283), quando `filtros.tiposFinanceiros = []`, `.in('tipo', [])` retorna sempre 0. O caller atual evita, mas não há defesa no service.

#### A5. DRE com cálculo de período local-time
Em `buildDreDateRange` (linha 35-47), o cálculo do último dia do mês usa `new Date(y, m, 0)` no fuso local. Em servidor UTC seria ok; no browser pt-BR resulta correto, mas concatenar `.toISOString().slice(0, 10)` em horário próximo da meia-noite pode dar dia anterior. Risco baixo mas presente.

#### A6. Filtros de cliente/fornecedor não chegam em todos os relatórios
- `vendas` filtra por `cliente_id` ✓
- `vendas_cliente`, `compras_fornecedor` (rankings) — verificar (provavelmente recebem o filtro mas o ranking ignora se o cliente não tem vendas no período)
- `aging`, `dre` — `clienteIds`/`fornecedorIds` chegam mas alguns case do switch não os aplicam. Inconsistência por relatório.

### B. Geração & consistência

#### B1. KPIs ≠ totais ≠ rodapé
3 caminhos de cálculo:
- `kpis` no service (`totalReceber`, `totalPagar` etc.)
- `totals` no service (campos arbitrários)
- `footer` na UI (`Relatorios.tsx:434-444`) recalcula `Number(r[col.key] || 0)` por coluna marcada `footerTotal`

Em `vendas`, o KPI `totalVendido` é a soma de **todos** os pedidos, mas o rodapé soma a coluna `valor` da `sortedRows` (já filtrada por status). Filtros aplicados no client → discrepância KPI vs rodapé. Usuário vê KPI = R$ 100k e rodapé = R$ 60k sem explicação.

#### B2. Reconstrução do filter no client
`filtrarPorStatus` e `sortarRows` (em `utils/relatorios.ts`) rodam **depois** do fetch. Ou seja:
- KPIs do `resultado.kpis` refletem o universo do banco.
- Rows visíveis (`sortedRows`) refletem filtro client.
- Export usa `sortedRows` → exporta o que o usuário vê ✓ correto.
- Mas o **PDF inclui o rodapé "Total de registros: N"** baseado em `rows.length` no service (`export.service.ts:349`), não no `sortedRows.length`. Wait — passamos `sortedRows` como `rows`, então `rows.length` é o filtrado. ✓ ok.

Real bug: o **rodapé visual** (`Relatorios.tsx:438`) usa `sortedRows.reduce(...)`, mas o KPI usa `kpis` do service. Inconsistência declarada.

#### B3. Agrupamento "valor_desc" quebra ordem temporal sem aviso
`sortarRows` em `utils/relatorios.ts:144` ordena por `valor`/`valorTotal`. Em `fluxo_caixa`, `valor` não existe na linha (campos são `entrada`/`saida`/`saldo`). Resultado: ordenação no-op silenciosa. Usuário escolhe "Maior valor" e nada muda.

#### B4. `_isQuantityReport` flag espalha condicional na UI
- `formatCellValue(value, key, isQuantityReport)` decide se trata número como moeda ou quantidade.
- Heurística: `["valor", "custo", "venda", "entrada", "saida"].some(f => key.includes(f))` → moeda.
- Em `movimentos_estoque`, `quantidade` é número e `entrada`/`saida` são labels (não keys). OK.
- Mas em `fluxo_caixa.entrada`/`saida`, são valores monetários e o flag `_isQuantityReport=false` faz funcionar. Frágil — depende de string matching de chave.

#### B5. Datas string vs Date no service
- `data_emissao`, `data_vencimento` chegam como `"YYYY-MM-DD"` strings.
- O service converte com `new Date(data)` (linha 299) sem o helper `normalizeDate` de `lib/format.ts`. Em fuso negativo, `new Date("2024-01-15")` dá dia 14 às 21h local. Cálculo de `atraso` pode errar 1 dia.

### C. Exportação (CSV/Excel/PDF)

#### C1. **CSV sem BOM UTF-8**
Todos os 4 emissores de CSV (`export.service`, `DataTable`, `social.service`, `ReconciliacaoDetalhe`) gravam apenas `text/csv;charset=utf-8` sem `\uFEFF`. Excel pt-BR abre como Windows-1252 → "São Paulo" vira "São Paulo". **Bug real e visível** em qualquer cliente Excel desktop.

#### C2. Nome de arquivo sem sanitização nem timestamp
`exportarParaCsv({ titulo: "Contas a Pagar e Receber" })` → arquivo `Contas a Pagar e Receber.csv` com espaços e acentos. Em alguns sistemas o `a.download` quebra. Sem uso de `toSlug` (que existe em `lib/utils.ts`) nem timestamp para evitar overwrite.

#### C3. Três caminhos de XLSX divergentes
- `export.service.ts` usa `exceljs` (correto, sem prototype pollution — alinhado com memória `relatorios`).
- `DataTable.tsx:373-377` e `social.service.ts:132-140` usam `XLSX` (`xlsx-compat`). 
- Memória `features/relatorios` define **exceljs como padrão**. `DataTable` e `social` violam.

#### C4. PDF jsPDF "cru" no DataTable (linha 382-407)
- Renderiza `pdf.text(line.slice(0, 180), ...)` numa linha só, sem tabela. Resultado ilegível.
- 50 rows fixos por página, sem paginação dinâmica nem cabeçalho de tabela. Existe `export.service.buildPdfDocument` muito melhor — DataTable não usa.
- Toolbar global do DataTable oferece "Exportar PDF" para qualquer tela; usuário aciona e recebe lixo.

#### C5. Validação `if (!rows.length) return` divergente
- `exportarParaCsv` baixa arquivo "Sem dados para exportação" (texto na cara).
- `exportarParaExcel` retorna sem fazer nada (sem aviso).
- `exportarParaPdf` segue o fluxo e faz PDF vazio.

Inconsistência: usuário pede Excel sem dados → nada acontece, ele clica de novo.

#### C6. Sem loading durante geração no `Relatorios.tsx`
`handleExportXlsx`/`handleExportPdf` são `async` (chamam `exceljs` + `jsPDF` dinamicamente, ~200ms+). Mas o handler chama `toast.success(...)` antes mesmo do `await` resolver de fato (na verdade após — ok), e **não tem `toast.loading`/lock de botão**. Usuário em conexão lenta clica 3x → 3 PDFs. `DataTable` ✓ tem loading com `toast.loading + id`. Inconsistência.

#### C7. Limite arbitrário de 200 rows no PDF
`PDF_MAX_ROWS = 200` em `export.service.ts:188`. Hardcode global. Não é por relatório (DRE tem ~30 linhas, vendas pode ter 5000). Sem opção de "exportar paginado" — só Excel resolve. Aviso impresso no próprio PDF (linha 317), mas o usuário só vê depois de gerar. UX ruim.

#### C8. PDF não inclui linha de totais nem KPIs
`buildPdfDocument` imprime "Total de registros: N" mas **não imprime os KPIs** (`totalReceber`, `totalPagar` etc.) nem o rodapé de totais por coluna que aparece na UI. Pré-visualização e exportação divergem.

#### C9. Cabeçalho PDF hardcoded vermelho `(105,5,0)`
`doc.setFillColor(105, 5, 0)` (linha 288). Sem relação com o tema/paleta da empresa. Empresa branca-azul recebe PDF com header vinho-escuro. Não é design (fora do escopo) mas é técnico — cor mágica sem constante nomeada.

#### C10. Empresa info parcialmente carregada no PDF
`empresaConfig` vem de `useRelatoriosFiltrosData`. Se a query falhar/estiver carregando, PDF gera **sem cabeçalho da empresa**. Sem fallback nem aviso.

### D. Impressão

#### D1. Sem suporte real a impressão
- Único `print:` no projeto: `Relatorios.tsx:478` (`print:space-y-4`) — define spacing para print mas **não há botão "Imprimir"** em parte alguma.
- `PreviewModal` é usado como pré-visualização, mas seu `Dialog` por padrão tem `print` styles que escondem overlay, então `Ctrl+P` no dialog imprime a página de fundo, não o modal.
- `OrcamentoPdfTemplate` é otimizado para html2canvas, não para impressão direta.

Alternativas:
- Adicionar botão "Imprimir" no `PreviewModal` que dispara `window.print()` com CSS `@media print` que esconde tudo exceto o modal.
- Para orçamento/NF, expor PDF como impressão real.

#### D2. Quebra de página inexistente
Sem `page-break-before/after/avoid` nas tabelas. Imprimir uma lista de 200 linhas → tabela cortada no meio sem cabeçalho repetido na próxima página.

### E. Estrutura de código

#### E1. `relatorios.service.ts` com 1164 linhas (god module)
- 15 cases de relatório no mesmo `switch`.
- Lógica de raw shape + map + agregação + KPI + chartData inline em cada case (~60 linhas cada).
- Funções `exportarCsv`/`exportarXlsx`/`formatCellValue` no fim — **`exportarCsv` e `exportarXlsx` não têm caller** (replaced por `export.service.ts`).
- `formatCellValue` duplicado: usado pelo `Relatorios.tsx` (linha 165) e mais elaborado em `formatCellValuePdf` (no `export.service`).

#### E2. Helpers de export espalhados
- `services/export.service.ts` (CSV/Excel/PDF config-aware) — bom, deve ser o único.
- `services/relatorios.service.ts` linhas 1086-1138 — duplicata morta.
- `services/social.service.ts:125-141` — versão própria (sem BOM, sem column config).
- `components/DataTable.tsx:358-421` — versão própria inline.
- `components/importacao/ReconciliacaoDetalhe.tsx:49-51` — outro CSV inline.

#### E3. Formatação repetida
`new Date(x).toLocaleDateString("pt-BR")` aparece em 217 ocorrências em 24 arquivos. Existe `formatDate` em `lib/format.ts`. Adoção parcial.

#### E4. Sem tipo único para "linha de relatório exportável"
`ExportColumnDef` existe (`export.service`), mas cada caller monta o array de rows com tipo `Record<string, unknown>`. Não há tipagem por relatório. Em `Logs.tsx`/`Conciliacao.tsx`/`FluxoCaixa.tsx`/`useFinanceiroActions.ts`, cada um redefine os labels manualmente em 4 lugares — risco de divergência (Excel vs PDF vs UI).

## Estratégia de correção (escopo desta passada)

### Fase 1 — CSV BOM (crítico, 1 linha por emissor)
Adicionar `\uFEFF` no início do conteúdo CSV em:
- `services/export.service.ts:78,88` — `exportarParaCsv`
- `services/social.service.ts:128` — `exportSocialCsv`
- `components/DataTable.tsx:367` — inline CSV
- `components/importacao/ReconciliacaoDetalhe.tsx:49` — inline CSV

Resultado: Excel desktop pt-BR abre acentuado correto.

### Fase 2 — Sanitizar nome de arquivo + timestamp
Criar helper em `lib/utils.ts`:
```ts
export function buildExportFilename(title: string, ext: string): string {
  const slug = toSlug(title) || 'export';
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${slug}_${ts}.${ext}`;
}
```
Adotar em `export.service.ts` (CSV/Excel/PDF) e nos 3 callers inline (DataTable, social, reconciliação).

### Fase 3 — Defesa contra arrays vazios em filtros
Em `relatorios.service.ts`, normalizar todas as branches:
```ts
if (filtros.clienteIds?.length) query = query.in('cliente_id', filtros.clienteIds);
```
Aplicar em linhas 166, 223, 283, 352, 413, 461 e demais ocorrências.

### Fase 4 — Subquery `movimentos_estoque` com limite
Em `relatorios.service.ts:223-225`, mover a busca pra fora do `.in()`, adicionar `.limit(10000)` defensivo, e logar/avisar se `error`:
```ts
let produtoIds: string[] | null = null;
if (filtros.grupoProdutoIds?.length) {
  const { data: prods, error: prodErr } = await supabase
    .from('produtos').select('id')
    .in('grupo_id', filtros.grupoProdutoIds).limit(10000);
  if (prodErr) throw prodErr;
  produtoIds = prods?.map(p => p.id) ?? [];
}
if (produtoIds) query = query.in('produto_id', produtoIds);
```

### Fase 5 — Loading + lock em export do Relatorios.tsx
Migrar `handleExportXlsx`/`handleExportPdf` para o padrão `toast.loading + id` que `DataTable` já usa, e adicionar `useState isExporting` para desabilitar botões durante o `await`.

### Fase 6 — Validação consistente "sem dados"
Em `export.service.ts`:
- `exportarParaExcel`: emitir `toast.warning("Nenhum dado para exportar")` (importar `sonner`) e retornar.
- `exportarParaPdf`: idem.
- `exportarParaCsv`: trocar arquivo "Sem dados…" por `toast.warning` + return.

(O caller `Relatorios.tsx` já valida `sortedRows.length`, mas outros — `Conciliacao`, `Logs`, `useFinanceiroActions` — não. Defesa em service.)

### Fase 7 — Remover código morto
Em `services/relatorios.service.ts`, deletar `exportarCsv`, `exportarXlsx`, `formatCsvValue` (linhas 1086-1145). `formatCellValue` mantém — é usado.

### Fase 8 — DataTable PDF: usar export.service
Em `components/DataTable.tsx`, substituir o bloco PDF inline (linhas 382-407) por chamada a `buildPdfDocument`/`exportarParaPdf` do `export.service`. Mesma para Excel — usar `exportarParaExcel` em vez de `XLSX.writeFile` direto. Remove duplicação e padroniza saída.

### Fase 9 — Padronizar `social.service` em `export.service`
Refatorar `exportSocialCsv`/`exportSocialXlsx` para delegar a `exportarParaCsv`/`exportarParaExcel`, passando `columns` definidas. Mantém API pública para o caller, muda implementação. (O multi-sheet do social precisa de extensão em `exportarParaExcel` aceitando `sheets?: { name: string; rows: ...; columns?: ... }[]` — adicionar suporte.)

### Fase 10 — `agrupamento` defensivo
Em `utils/relatorios.ts:sortarRows`, quando `valor`/`valorTotal` ausentes, tentar `entrada + saida` (fluxo de caixa). Documentar via JSDoc qual chave é considerada.

### Fase 11 — Botão "Imprimir" no PreviewModal
Adicionar prop `onPrint` opcional ou botão fixo "Imprimir" no `PreviewModal` que chama `window.print()`, com CSS global mínimo:
```css
@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; inset: 0; }
}
```
Aplicar classe `print-area` no conteúdo do modal. Em `Relatorios.tsx`, adicionar `onPrint` ao `PreviewModal`.

### Fase 12 — Coerência KPI ↔ rodapé ↔ export
Documentar (JSDoc) e enforce: KPIs do `resultado.kpis` são do **universo do banco** (filtros server-side); o rodapé visual e o export usam **rows visíveis** (após filtros client). Adicionar nota visual sutil quando os dois divergem (`hiddenColumns + filtrarPorStatus + sortarRows` aplicados): "Filtros locais aplicados — totais refletem visíveis." Implementação: comparar `rows.length` vs `sortedRows.length` em `Relatorios.tsx` e exibir hint.

## Fora do escopo
- Quebrar `relatorios.service.ts` em arquivos por relatório (refactor amplo, ~15 modules).
- `@react-pdf/renderer` para PDFs visualmente fiéis (mudança de stack).
- Repetição de cabeçalho de tabela em impressão multi-página.
- Substituir `xlsx-compat` por `exceljs` em todos os hooks de importação (eles leem, não escrevem — risco baixo).
- Migrar todas as 217 ocorrências de `toLocaleDateString` para `formatDate`.
- Alinhar cor do PDF com tema da empresa (depende de design tokens).
- Tipagem por relatório das `ExportRow` (precisa schema por tipo).

## Critério de aceite
- CSV gerado abre com acentos corretos no Excel desktop pt-BR (BOM presente).
- Nomes de arquivo sanitizados + timestamp (`vendas-por-periodo_2026-04-18-14-30-00.xlsx`).
- Filtros multi-select com array vazio não derrubam o resultado para 0.
- `movimentos_estoque` com filtro de grupo: erro de subquery sobe (não silencia).
- Botões de export do Relatorios mostram loading e ficam desabilitados durante o `await`.
- "Nenhum dado" → toast warning único em todos os formatos.
- `relatorios.service.ts` sem código morto (`exportarCsv`/`exportarXlsx` removidos).
- `DataTable` PDF usa `buildPdfDocument` (saída tabular profissional).
- `social.service` exports delegam para `export.service`.
- `PreviewModal` aceita `onPrint` e dispara `window.print()` com CSS print isolado.
- Build OK, testes passam.

## Arquivos afetados
- `src/services/export.service.ts` — BOM, filename helper, validação `toast.warning`, suporte multi-sheet
- `src/services/relatorios.service.ts` — defesa `?.length`, subquery limit, remover código morto, normalizar datas
- `src/services/social.service.ts` — delegar a `export.service`
- `src/components/DataTable.tsx` — BOM, filename helper, usar `export.service` para PDF/Excel
- `src/components/importacao/ReconciliacaoDetalhe.tsx` — BOM CSV
- `src/components/ui/PreviewModal.tsx` — botão imprimir + classe `print-area`
- `src/pages/Relatorios.tsx` — loading nos exports, hint KPI vs visíveis, `onPrint`
- `src/utils/relatorios.ts` — `sortarRows` defensivo para fluxo de caixa
- `src/lib/utils.ts` — adicionar `buildExportFilename`
- `src/index.css` — regras `@media print` para `.print-area`

## Entregáveis
Resumo final por categoria: CSV BOM, filenames sanitizados, defesa de filtros, subquery segura, loading/lock de export, validação "sem dados", remoção de código morto, padronização DataTable/Social via export.service, suporte a impressão no PreviewModal.

