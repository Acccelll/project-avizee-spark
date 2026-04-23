---
name: Relatórios — padrões mobile
description: Layout mobile-first do módulo Relatórios — chart-first, KPIs 2x2, filtros em bottom-sheet, tabela colapsada e sticky Exportar
type: design
---

# Relatórios — padrões mobile (<768px)

Aplicado em `src/pages/Relatorios.tsx` e componentes em `src/pages/relatorios/components/`.

## Hierarquia mobile (top→bottom)

1. `ReportHeader` compacto: 1 linha (← Voltar + menu ⋯) + título truncado + período.
2. **KPIs 2x2** — `grid-cols-2 xl:grid-cols-4` (4 KPIs viram 2x2 em mobile).
3. **Botão único "Filtros (n)"** + ícone Atualizar — `flex md:hidden`.
4. **Chart primeiro** (mobile-only block `md:hidden`) — insight central antes da tabela.
5. **Tabela em `Collapsible`** ("Ver registros (n) ▾") fechada por padrão.
6. **Sticky footer** com `ExportMenu fullWidth` — `md:hidden sticky bottom-0`.

Desktop (md+) preserva o layout `xl:grid-cols-[2fr_1fr]` original (tabela à esquerda, chart à direita).

## Filtros em bottom-sheet

`Sheet side="bottom"` com `max-h-[85vh] overflow-y-auto`:
- Header sticky com título.
- `PeriodoFilter` + `FiltrosRelatorio` empilhados.
- Footer sticky com 2 botões `min-h-11`: "Limpar" (se há filtros) + "Aplicar".

## DataTable mobile props (derivadas de semantics)

```ts
const mobileTableProps = {
  mobileStatusKey: semantics?.statusField ?? coluna em ['status','criticidade','faixa','classe','tipo'],
  mobileIdentifierKey: 1ª coluna textual não-status e não-numérica,
};
```

Spread em `<DataTable {...mobileTableProps} />` — cards mobile ganham status pill + identificador secundário automaticamente para todos os 14 tipos de relatório.

## Header mobile (`ReportHeader.tsx`)

- `useIsMobile()` → ramo dedicado.
- ← Voltar `min-h-11`, menu `⋯` com `DropdownMenu` recebendo `actions` (Atualizar / Salvar / Aplicar favorito) — `w-[calc(100vw-2rem)]`.
- Título `text-lg truncate`, período como subtitle `text-xs`.

## Catálogo (`RelatorioCatalogo.tsx`)

- Input de busca + chips de categoria scrolláveis (`overflow-x-auto`).
- Cards `min-h-14`/`min-h-16` com `active:bg-muted` para feedback de toque.
- Prioritários ocultos quando há busca/filtro de categoria.
- Em mobile, prioritários viram `grid-cols-1` (linha cheia, fácil de tocar).

## Componentes ocultos em mobile

- "Visualizar" (PreviewModal A4) — `hidden md:flex` no Card de filtros desktop.
- "Colunas" — sem efeito em cards mobile.
- "Compacto" — densidade só afeta tabela desktop.

Esses 3 botões + filtros desktop ficam no `Card className="hidden md:block"`.

## Polimento

- `ActiveFiltersBar`: `overflow-x-auto md:flex-wrap` + chips `flex-shrink-0` + botão remover `min-h-6 min-w-6`.
- `RelatorioChart` lista top-6: `truncate` no nome, `tabular-nums flex-shrink-0` no valor.
- `DreTable`: `tabular-nums`, padding `p-2 sm:p-4`, resultado `text-base sm:text-lg`, valor `whitespace-nowrap`.
- `ExportMenu`: prop `fullWidth` para sticky footer; botão `min-h-11 sm:min-h-9`.
- Skeletons reais para loading da tabela e do chart (substituem texto "Carregando…").

## Princípio doutrinário

> "Insights primeiro, tabela depois." Em mobile, o usuário quer ver KPIs e gráfico em 1 scroll. Tabela completa é opcional/colapsada. Exportar é a ação real do usuário no celular — vira CTA sticky.
