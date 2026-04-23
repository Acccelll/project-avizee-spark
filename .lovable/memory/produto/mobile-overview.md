---
name: ERP mobile overview
description: Doutrina transversal de mobile do ERP — status quo, contratos consolidados e backlog
type: feature
---
ERP é hoje "mobile-capable" (não mobile-first): operação 80% rodável em celular, configuração avançada exige desktop.

**Contratos transversais ativos:**
- Toda DataTable com coluna de status DEVE passar `mobileStatusKey` + `mobileIdentifierKey` (DataTable agora avisa em dev se omitido).
- Cadastros simples cobertos: clientes, produtos, fornecedores, transportadoras, funcionários, sócios, formas_pagamento, grupos-economicos, contas-bancarias, contas-contabeis, unidades-medida.
- **`<Dialog>` é responsivo por default** — em mobile vira bottom-sheet (rounded-t, slide-from-bottom, drag handle, safe-area). Em desktop continua centralizado. Consumidores não precisam mais aplicar classes `max-sm:` manualmente. FormModal opta out via override (full-screen mobile para forms longos).
- **`<DialogFooter>` é sticky+full-width em mobile** — botões viram `min-h-11 w-full`, empilhados (CTA primário em cima por `flex-col-reverse`).
- ConfirmDialog (useConfirmDialog) já é bottom-sheet em mobile.
- Drawer responsivo: edição complexa = página, não drawer (ver mem://produto/quando-drawer-quando-pagina).
- Sticky footer "salvar quando dirty" em forms longos.
- Touch target mínimo 44px (h-11) em ações primárias.
- Bottom nav fixo (Início + Comercial + Cadastros + Financeiro + Menu); MobileMenu lista TODAS seções (sem filtrar duplicadas com bottom nav).

**Backlog priorizado:**
1. ResponsiveDialog wrapper único (substituir Dialog/AlertDialog manuais) — baixa prioridade, ganho marginal.
2. PeriodFilter global no header mobile (Tier C2) — estrutural, sprint dedicado.
3. ItemsGrid único para forms (Tier C3) — estrutural, sprint dedicado.

**Resolvido recentemente:**
- RelationalDrawerStack: limite efetivo 3 em mobile via `MAX_DRAWER_DEPTH_MOBILE` (provider escolhe via `useIsMobile`); breadcrumb encadeado já clicável (`DrawerStackBreadcrumb` ativo quando `total > 1`, sticky junto ao header).
- Sticky footer "salvar dirty" em todos cadastros: já provido transversalmente por `FormModal` + `FormModalFooter` (full-width `max-sm:w-full`, `min-h-11`, CTA em cima via `flex-col-reverse`) combinado com `DialogFooter` sticky+bottom-sheet em mobile.
- Filtros bottom-sheet em Estoque, Logística e Compras: já provido por `AdvancedFilterBar` (Drawer bottom nativo do vaul com badge de contagem, "Limpar filtros" e "Ver resultados (N)").
- Sticky footer mobile "salvar dirty" também em forms longos `PedidoForm` e `RemessaForm` (footer `md:hidden fixed bottom-0` com `flex-col-reverse`, CTA primário em cima, full-width `min-h-11`, safe-area). `OrcamentoForm` já tinha.
- `<ScrollableTabsList>` (em `src/components/ui/scrollable-tabs.tsx`): wrapper sobre `TabsList` com `overflow-x-auto`, scrollbar oculta e fade-edges dinâmicos detectados via scroll. Aplicado em `Estoque`, `Logistica` e `Social`.
- Auditoria mobile: filtros viraram `grid grid-cols-2` (full-width) em mobile, mantendo flex-wrap em desktop; `DataTable` recebeu `mobileStatusKey="criticidade"` + `mobileIdentifierKey="entidade"` para card mobile correto.
- Social mobile: filtros (data início/fim + rede + tipo) viraram `grid grid-cols-2 md:flex` (full-width em <768px); `SocialContasTab` recebeu `mobileStatusKey="status_conexao"` + `mobileIdentifierKey="nome_conta"`; `SocialPostsTab` recebeu `mobileStatusKey="tipo_post"` + `mobileIdentifierKey="titulo_legenda"`. `ScrollableTabsList` já cobre as 6 tabs.
- Bottom nav contextual: `MobileBottomNav` agora troca os atalhos centrais conforme `activeKey` da rota. Mapa `CONTEXTUAL_TABS_BY_SECTION` cobre comercial (Orçamentos/Pedidos), compras (Cotações/Pedidos), estoque (Estoque/Logística), financeiro (Lançamentos/Fluxo), fiscal (Entrada/Saída) e cadastros (Clientes/Produtos/Fornecedores). Início e Menu sempre fixos; tabs contextuais respeitam permissões e fallback para o conjunto global se nenhuma for permitida.
- Lint de touch targets mobile (`scripts/lint-touch-targets.mjs`, alias `npm run lint:touch-targets`): escaneia `src/**` por elementos clicáveis (`Button`, `button`, `onClick`, `role="button"`, `<a>`, `<Link>`) com `h-1..h-10` (<44px), ignorando contextos seguros (Badge, Avatar, Icon, Loader, Skeleton, `aria-hidden`). Reporta arquivo:linha + trecho. Exit 1 quando há violações — pronto para integrar a CI.
