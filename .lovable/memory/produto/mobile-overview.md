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
1. Sticky footer dirty em forms de cadastros restantes (FormasPagamento, ContasBancarias, GruposEconomicos, Funcionarios edit).
2. Filtros bottom-sheet em Estoque, Logística, Compras.
3. Bottom nav contextual por módulo ativo.
4. Revisão dedicada: Auditoria, Migração, Social.

**Resolvido recentemente:**
- RelationalDrawerStack: limite efetivo 3 em mobile via `MAX_DRAWER_DEPTH_MOBILE` (provider escolhe via `useIsMobile`); breadcrumb encadeado já clicável (`DrawerStackBreadcrumb` ativo quando `total > 1`, sticky junto ao header).
