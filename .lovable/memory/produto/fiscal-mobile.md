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

## DanfeViewer mobile
- `DialogContent` vira bottom-sheet (`max-sm:fixed inset-x-0 bottom-0 rounded-t-2xl max-h-[92svh]`) com safe-area inferior.
- Emitente/Destinatário em `grid-cols-1 sm:grid-cols-2`.
- Lista de itens vira **cards verticais** em mobile (`sm:hidden`); tabela HTML preservada para `sm:block`.
- Grid de impostos secundários: `grid-cols-3 sm:grid-cols-5` para evitar squish em mobile.

## FormModal de NF (Fiscal.tsx + NotaFiscalEditModal)
- Bloco "Frete, Impostos e Despesas" envolto em `Collapsible` em mobile (`md:hidden` no trigger; `md:!block` no content), colapsado por padrão.
- Inputs numéricos: `h-11 md:h-8` + `inputMode="decimal"` para abrir teclado numérico no celular.
- Padrão reutilizável para qualquer bloco fiscal "avançado" que polui form mobile.
