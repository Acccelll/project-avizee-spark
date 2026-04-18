

# Diagnóstico visual — Relatórios, Exportações e Impressão

## Inventário visual

| Área | Estado atual |
|---|---|
| Header do relatório | Card com título + objetivo. Botão "Voltar" como linha separada acima — info dispersa. |
| KPIs | `SummaryCard` em grid 4-col. Bom, mas não tem indicação de quando reflete universo do banco vs filtros locais. |
| Barra de filtros | Tudo achatado em 1 row: período + 9 botões de ação + filtros adicionais empilhados. ~12-15 controles na mesma faixa. |
| Ações export/preview | 7 botões (Salvar, Carregar, Atualizar, Visualizar, Colunas, PDF, Excel, CSV) em row única, todos `variant="outline"` exceto CSV. Hierarquia rasa. |
| Área de resultado | Tabela + chart lado-a-lado em 1fr/380px. Footer de totais inline, fonte pequena, cinza. |
| Empty state | Texto pequeno em cinza no rodapé do card (`<div className="px-4 pb-4 text-xs ...">`) — quase invisível. |
| Preview modal | Simples `<table>` com listras, cabeçalho/totalizadores em texto plano. Botões PDF/Excel/CSV/Imprimir todos `outline sm` — sem CTA primária. |

## Problemas reais

### 1. Header pobre e espalhado
Hoje: `[← Voltar]` linha solta + Card com `<title icon>Vendas` + descrição. Sem chip de categoria, sem período em destaque, sem contagem de registros visível. Usuário precisa olhar 3 áreas (botão voltar, header do card, filtros) para entender o contexto.

### 2. Toolbar de ações sem hierarquia
7 botões iguais (`variant="outline" size="sm"`) misturados:
- Salvar/Carregar (gestão de favoritos)
- Atualizar (refresh)
- Visualizar (preview)
- Colunas (config)
- PDF/Excel/CSV (export)

CSS unifica todos. Visualmente é "muralha de botões". Falta agrupamento por intenção (config | view | export). CSV é `variant="default"` (primária) sem motivo claro — Excel é o formato mais usado em ERPs.

### 3. Filtros sem hierarquia
- `PeriodoFilter` (data inicial/final + 4 quick periods) e `FiltrosRelatorio` (cliente/fornecedor/grupo/status/agrupamento/tipos) estão na mesma `<Card>` mas em rows separados sem separador visual.
- Quick periods aparecem como 4 botões soltos sem indicação de qual está ativo.
- Multi-selects todos com `w-[250px]` fixo — cliente longo trunca, grupo curto fica largo demais.
- Filtros aplicados não viram chips removíveis (padrão Linear/Notion). Usuário precisa abrir cada multi-select pra ver o que está filtrado.

### 4. Sem "resumo do filtro aplicado"
Após escolher 5 clientes + período + status, o usuário não vê em texto "Vendas a 5 clientes • 01/01 a 31/01 • Em aberto". Não há linha-resumo, dificulta auditoria visual e screenshot.

### 5. KPIs não indicam escopo
4 cards de SummaryCard. Não tem subtítulo "do período" ou ícone informativo. Quando filtros locais aplicados (banner amarelo já implementado), KPIs continuam visualmente iguais mesmo divergindo dos totais visíveis. Sem hint visual no card.

### 6. Footer de totais subaproveitado
```tsx
<div className="border-t bg-muted/30 px-4 py-2 ... text-xs font-semibold text-muted-foreground">
```
Texto cinza pequeno. Em relatório financeiro o footer é o ponto mais importante — deveria ter destaque tipográfico (bold, tabular-nums, alinhado por coluna).

### 7. Empty state invisível
```tsx
{showEmpty && <div className="px-4 pb-4 text-xs text-muted-foreground">...</div>}
```
+ DataTable já tem seu próprio empty. Dois empties competindo. O do Relatorios é texto-cinza-12px no rodapé — usuário com lista vazia não percebe que precisa ajustar filtros.

### 8. Preview modal: tabela "papel quadriculado"
- Listras zebras simples, sem cabeçalho com logo/empresa visível, sem KPIs no topo.
- Totalizadores em row de spans `flex flex-wrap gap-4` — alinhamento aleatório.
- Botões na ação top: PDF/Excel/CSV/Imprimir todos pequenos outline — sem destaque para a ação principal (provavelmente Imprimir, dado que está em pré-visualização).

### 9. Chart "tampado" pelo lado direito
Grid `xl:grid-cols-[1fr_380px]` força chart fixo de 380px. Em 1128px (viewport atual), tabela fica ~700px e chart 380px — chart ocupa 33% sem motivo. Prioridade de leitura é tabela, não chart.

### 10. Falta densidade controlável
Tabela com `[size]="default"` (linhas altas). Em relatório de 200 linhas, usuário rola muito. Sem toggle "compact" (já existe `density` em SummaryCard, mas não aplicado).

### 11. Period em texto pequeno na descrição
`periodoLabel` só aparece no preview. Na tela principal, usuário vê "Data inicial: 01/01" + "Data final: 31/01" mas não tem chip "Período: 01/01 a 31/01" no header — informação importante fica enterrada.

### 12. Exportação sem confirmação visual do escopo
Clicar PDF gera direto. Não mostra mini-resumo "Exportando 47 registros, 8 colunas, ~2 páginas". Toast loading aparece mas sem detalhe.

## Padrão-base proposto

### A. Header do relatório (`ReportHeader` novo)
Componente único que substitui o bloco "voltar + card title". Layout:
```
┌─────────────────────────────────────────────────────────┐
│ ← Voltar     Comercial · Vendas    [chip período]       │
│                                                         │
│ Vendas por Período          [Atualizar] [Salvar ▾]     │
│ Análise consolidada de pedidos...                       │
└─────────────────────────────────────────────────────────┘
```
- Breadcrumb leve "Categoria · Relatório"
- Chip de período em destaque ao lado do título
- Ações de "config/refresh" no canto superior direito (separadas das exports)

### B. Toolbar dual: filtros (esquerda) + ações (direita)
Separar visualmente:
- **Linha 1 (filtros)**: Período + quick periods (com active state) + filtros do relatório.
- **Linha 2 (chips ativos)**: Lista de filtros aplicados como `Badge` removíveis (`Cliente: ACME ×`, `Status: Em aberto ×`).
- **Ações de export**: movidas para um grupo dedicado `[Visualizar] [Colunas ▾] [Exportar ▾]` — Exportar vira dropdown com PDF/Excel/CSV (uma CTA primária + 3 opções). Reduz de 7→3 botões visíveis.

### C. Quick periods com active state
`PeriodoFilter` ganha prop `selected?: QuickPeriod` calculada via comparação de strings. Botão ativo: `variant="default"` em vez de `outline`. Adicionar opção "Personalizado" (mostra os date inputs só quando ativa) — colapsa por padrão para reduzir densidade.

### D. KPIs com badge de escopo
Quando `rows.length !== sortedRows.length`, cada `SummaryCard` ganha uma anotação sutil "universo" (info icon + tooltip). E adicionar **um** `SummaryCard` de "Registros visíveis" como 5º card (ou substituir variation por contador).

### E. Footer de totais com destaque
Trocar `<div bg-muted/30 text-xs text-muted-foreground>` por bloco com:
- `bg-muted/50`, padding maior (py-3)
- Labels em `text-xs uppercase tracking-wide`
- Valores em `text-base font-bold tabular-nums text-foreground`
- Alinhamento por coluna (cada total alinhado abaixo da coluna correspondente quando possível)

### F. Empty state real
Substituir `<div ... text-xs>` por componente `EmptyState` (já existe) com `variant="noResults"`, ícone `SearchX`, título "Nenhum dado para os filtros atuais" e CTA "Limpar filtros" (reset de search params exceto `tipo`).

### G. PreviewModal: layout "documento"
- Cabeçalho com logo/empresa (de `empresaConfig`) + meta (período, data de geração, usuário).
- KPIs em grid 4-col (mesma do main, em formato compacto).
- Tabela com cabeçalho repetível, alinhamento numérico right, linhas com `tabular-nums`.
- Footer de totais idêntico ao da tela principal.
- Action bar com **Imprimir** como CTA primária (`variant="default"`) + dropdown "Exportar" (PDF/Excel/CSV) — alinhado com o padrão da tela principal.

### H. Grid tabela:chart adaptativo
Trocar `xl:grid-cols-[1fr_380px]` por `xl:grid-cols-[2fr_1fr]` com max-width no chart (300-420px range). Em viewport <1280px, chart vai pra baixo full-width.

### I. Toggle de densidade (compact rows)
Adicionar botão `[≡ Compactar]` na toolbar de ações (junto com Colunas). Quando ativo, passa `density="compact"` ao DataTable (já suportado) e `compact` ao SummaryCard. Persiste em localStorage `relatorios:density`.

### J. Confirmação visual de export (toast.loading)
Já existe loading toast. Adicionar no `description`: "47 registros · 8 colunas". Usa `sortedRows.length` e `visibleColumns.length`.

### K. Resumo do filtro aplicado (linha sticky no topo do resultado)
Acima do DataTable, linha compacta:
```
📊 47 registros · Período 01/01–31/01 · Status: Em aberto · 5 clientes selecionados
```
Substitui o banner amarelo atual quando há filtros, e fica sutil quando não há (apenas "47 registros · Atualizado há 2 min").

## Implementação

### Componentes novos
1. **`src/pages/relatorios/components/ReportHeader.tsx`** — Header com breadcrumb, título, descrição, chip de período, slot de ações.
2. **`src/pages/relatorios/components/ReportToolbar.tsx`** — Toolbar dual: filtros à esquerda, ações de view/export agrupadas à direita.
3. **`src/pages/relatorios/components/ExportMenu.tsx`** — Dropdown unificado [Exportar ▾] → PDF/Excel/CSV com badge "47 registros".
4. **`src/pages/relatorios/components/ActiveFiltersBar.tsx`** — Linha de chips removíveis dos filtros aplicados + quick reset.
5. **`src/pages/relatorios/components/ReportResultFooter.tsx`** — Footer de totais com destaque tipográfico.
6. **`src/pages/relatorios/components/PreviewDocument.tsx`** — Layout "documento" do preview com cabeçalho empresa, KPIs, tabela, footer.

### Componentes ajustados
7. **`src/pages/relatorios/components/Filtros/PeriodoFilter.tsx`** — Active state nos quick buttons; opção "Personalizado" colapsável.
8. **`src/pages/Relatorios.tsx`** — Refatorar usando os componentes novos; remover blocos inline; adicionar toggle densidade; trocar empty inline por `EmptyState`; ajustar grid tabela:chart para `2fr_1fr`.
9. **`src/components/ui/PreviewModal.tsx`** — Aceitar `primaryAction?: ReactNode` para destacar CTA principal (Imprimir) acima dos demais botões.

### Sem mudanças (mas validados)
- `SummaryCard` (já tem `density="compact"`)
- `EmptyState` (já existe e atende o caso)
- `DataTable` (já tem virtualização e suporta densidade futura)
- `export.service.ts`, `relatorios.service.ts` (lógica intocada)

## Fora do escopo
- Refazer cor/tema do PDF (já documentado em diagnóstico anterior)
- Drill-down visual (chart click) — mantém comportamento atual
- Comparação entre períodos lado-a-lado — feature nova
- Salvar/agendar relatório por email — feature nova
- Mobile/responsive deep dive (foco é desktop ERP)
- Stepper visual nos filtros (relatórios são one-shot)

## Critério de aceite
- Header com breadcrumb, título, chip de período, ações secundárias separadas das de export.
- Toolbar com filtros à esquerda, ações de view/export à direita; export agrupado em menu único.
- Quick periods mostram qual está ativo.
- Filtros aplicados aparecem como chips removíveis acima do resultado.
- Footer de totais com tipografia destacada (bold, tabular, py-3).
- Empty state usando componente `EmptyState` com CTA "Limpar filtros".
- Preview modal com layout documento (header empresa + KPIs + tabela + footer) e botão Imprimir como CTA primária.
- Toggle densidade na toolbar persiste em localStorage.
- Toast de loading no export inclui "X registros · Y colunas".
- Build OK; sem regressão funcional na lógica de export/filtros.

## Entregáveis
Resumo final por categoria: header reorganizado, filtros com chips ativos, quick periods com state, ações de export agrupadas, footer com destaque, empty state padronizado, preview em formato documento, toggle de densidade.

