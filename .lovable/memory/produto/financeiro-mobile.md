---
name: Financeiro Mobile
description: Padrões mobile para Lançamentos, Conciliação, Fluxo de Caixa e Calendário do Financeiro
type: design
---

# Financeiro Mobile

## DataTable mobile (padrão consolidado)
- `financeiro-lancamentos`: `mobileStatusKey="status"`, `mobileIdentifierKey="descricao"`, `mobilePrimaryAction` = "Baixar" `h-11 w-full` (oculto se pago/cancelado), `mobileInlineActions` = "Ver" + "Editar".
- `conciliacao`: `mobileStatusKey="statusConciliacao"`, `mobileIdentifierKey="descricao"`.
- `fluxo-caixa-movimentos`: usa `DataTable` padrão; coluna `descricao` marcada como `mobilePrimary`.

## Bottom-sheets (mobile-only)
- `BaixaParcialDialog` e `BaixaLoteModal`: comportam-se como bottom-sheet em `max-sm` (rounded-t-2xl, footer sticky com safe-area-inset-bottom). Inputs numéricos usam `inputMode="decimal"`.
- `ConfirmDialog` (estorno/cancelamento): bottom-sheet em mobile com footer sticky `flex-col-reverse` e botões `min-h-11 w-full`. Resolve teclado cobrindo CTA.
- `FinanceiroCalendar` mobile: tap no dia abre `Sheet` bottom com lista de vencimentos + ação "Baixar" `h-11 w-full` por item.
- `Conciliacao` mobile: split OFX↔ERP é oculto (`hidden md:grid`); substituído por lista vertical de cards OFX. Cada card tem CTA "Vincular" → bottom-sheet com sugestões pré-filtradas por valor (±0.05) e data (±3 dias) + busca livre + lista completa colapsável.

## Filtros temporais
- `Financeiro` e `FluxoCaixa` usam `PeriodFilter` com `financialPeriods` (alinha com `mem://produto/contrato-de-periodos`). FluxoCaixa em modo `both` (chips + custom range).

## Touch targets
- Toggle Lista/Calendário, Exportar, Lançar: `h-9 sm:h-7 min-h-[36px]`.
- Chips e ações primárias em sheets: `min-h-11`.

## Banner mobile e KPIs
- "Vence Hoje" em mobile aparece como banner tappable acima dos KPIs (`md:hidden`, `min-h-11`, variant warning) — ao tocar, aplica `statusFilters=["aberto"]` + `period="hoje"`. O card duplicado dentro do grid é ocultado via `className="hidden md:flex"`.
- `BaixaLoteModal` exibe empty state quando aberto sem seleção (atalho Dashboard `?baixa=lote`) com instrução para selecionar títulos primeiro.
