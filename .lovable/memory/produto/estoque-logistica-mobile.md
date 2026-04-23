---
name: Estoque & Logística Mobile
description: Padrões mobile do Estoque/Logística — DataTable mobile props, EstoqueAjusteSheet, footers operacionais e bottom-sheets de rastreio
type: design
---

# Estoque & Logística — padrões mobile

## Listas (DataTable + MobileCardList)
- **Sempre** definir `mobileStatusKey`, `mobileIdentifierKey`, `mobilePrimaryAction`, `mobileInlineActions` quando a tabela tiver status visual e ações por linha. Sem isso o card vira lista cinza.
- Tabelas cobertas: `estoque-saldos`, `estoque-movimentacoes`, `logistica-entregas`, `logistica-recebimentos`, `logistica-remessas`.
- Para Saldos críticos/zerados: `mobilePrimaryAction` abre `EstoqueAjusteSheet` direto, **sem ir para a aba Ajuste**.

## Ajuste de estoque (operação sensível)
- Componente único reaproveitável: `src/components/estoque/EstoqueAjusteSheet.tsx`.
- Em mobile renderiza como **bottom-sheet** (`max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:rounded-t-2xl`); em desktop como right-sheet `sm:max-w-md`.
- Pré-preenchível por `produtoId` + `tipoInicial` (`entrada` | `saida` | `ajuste`).
- Pontos de entrada:
  - Chips do banner "Abaixo do mínimo" → `Ajustar` em pílula com `min-h-[44px]` e `tipoInicial="entrada"`.
  - `mobilePrimaryAction` da tabela `estoque-saldos` quando situação for `critico` / `zerado`.
- A aba "Ajuste Manual" do desktop continua existindo como fluxo principal (form completo com histórico lateral).

## Drawers operacionais (Logística)
- `EntregaDrawer` e `RecebimentoDrawer` usam `variant="operational"` + `footerSticky` + `<DrawerStickyFooter />` com **uma única ação primária por estado**:
  - Entrega com `codigo_rastreio` → "Rastrear Correios" (chama `correios-api`).
  - Recebimento não terminal → "Registrar recebimento" (navega para `/compras?recebimento=:id`).
- O footer respeita `safe-area` (já tratado no `Sheet` mobile do `ViewDrawerV2`).

## Rastreio
- `TrackingModal` em mobile vira **bottom-sheet** (mesmo padrão do `RegistrarRecebimentoDialog`); evite scroll aninhado — deixe o sheet inteiro rolar.
- `LogisticaRastreioSection` em mobile usa cards verticais com botão "Rastrear" full-width `h-11`.

## KPIs
- Logística mantém 4 KPIs principais sempre visíveis no mobile; KPIs secundários (taxa, tempo médio, pendentes) ficam em `Collapsible` "Mais métricas" para reduzir scroll inicial.

## Touch targets
- Inputs/Selects/Buttons em forms operacionais: `h-11` em mobile (`max-sm:h-11`).
- Chips clicáveis: `min-h-[44px]` em mobile.
- `inputMode="decimal"` para campos numéricos de quantidade.

## Header `ModulePage`
- Esconder atalhos redundantes em mobile (`max-sm:hidden`) quando a mesma ação já existe em tab/CTA primário do conteúdo.