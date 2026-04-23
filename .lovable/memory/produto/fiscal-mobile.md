---
name: Fiscal Mobile
description: Padrões mobile para listagem, drawer, devolução e certificado do módulo Fiscal
type: design
---

# Fiscal Mobile

## DataTable mobile (notas-fiscais / notas-entrada / notas-saida)
- `mobileStatusKey="status"` + `mobileIdentifierKey="parceiro"`.
- Status header empilha **ERP + SEFAZ** (sub-pill `text-[10px]`) só em mobile.
- `mobilePrimaryAction` contextual:
  - `pendente`/`rascunho` → "Confirmar NF" (primary, `min-h-11 w-full`).
  - `confirmada`/`autorizada`/`importada` → "DANFE" (outline).
  - demais → "Ver detalhes".
- `mobileInlineActions`: "Editar" (só editáveis, navega para `/fiscal/:id`) + menu "Mais ⋯" com Ver/DANFE/Devolução e **Estornar isolado abaixo de separator** (destrutivo nunca lado a lado com primary).

## NotaFiscalDrawer mobile
- Tabs reduzidas a 3: `Resumo`, `Itens (n)`, `Mais` (Fiscal/Arquivos/Eventos/Vínculos como sub-seções stacked). Desktop mantém 6 tabs.
- Tab Itens em mobile vira **lista de cards** (Nome + Qtd × Unit + total + chips CST/CFOP/Conta).
- Footer mobile: 1 ação primária full-width (Confirmar se aplicável; senão DANFE) + botão `MoreVertical` `min-h-11 min-w-11` que abre `DropdownMenu side="top"` com DANFE/Devolução e **Estornar abaixo de separator**.

## DevolucaoDialog mobile
- Lista de cards verticais com **stepper [−][qty][+]** (`min-h-11 min-w-11`) e Input central `h-11 inputMode="numeric"`.
- Tabela HTML preservada apenas para `md:block`.
- Total destacado como card sticky no fim da lista.

## KPIs e banner
- Mobile esconde "Total de NFs" (redundante com count); mantém 3 cards (Valor / Pendentes / Confirmadas).
- Banner tappable `md:hidden min-h-11 bg-warning/10` aparece quando há pendentes — toque aplica `statusFilters=["pendente"]`.

## Certificado
- `CertificadoValidadeAlert` ganha botão "Configurar Certificado" `min-h-11` que navega para `/configuracao-fiscal` em todos os níveis (expirado/7d/30d).

## Fluxo
- Editar em mobile sempre navega para `/fiscal/:id` (página) — não abre `NotaFiscalEditModal`. Alinha com `mem://produto/quando-drawer-quando-pagina`.
