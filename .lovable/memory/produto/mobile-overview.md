---
name: ERP mobile overview
description: Doutrina transversal de mobile do ERP — status quo, contratos consolidados e backlog
type: feature
---
ERP é hoje "mobile-capable" (não mobile-first): operação 80% rodável em celular, configuração avançada exige desktop.

**Contratos transversais ativos:**
- Toda DataTable com coluna de status DEVE passar `mobileStatusKey` + `mobileIdentifierKey` (DataTable agora avisa em dev se omitido).
- Cadastros simples cobertos: clientes, produtos, fornecedores, transportadoras, funcionários, sócios, formas_pagamento, grupos-economicos, contas-bancarias, contas-contabeis, unidades-medida.
- Bottom-sheet > Dialog em mobile para fluxos de decisão.
- Drawer responsivo: edição complexa = página, não drawer (ver mem://produto/quando-drawer-quando-pagina).
- Sticky footer "salvar quando dirty" em forms longos.
- Touch target mínimo 44px (h-11) em ações primárias.
- Bottom nav fixo (Início + Comercial + Cadastros + Financeiro + Menu); MobileMenu lista TODAS seções (sem filtrar duplicadas com bottom nav).

**Backlog priorizado:**
1. `<ResponsiveDialog>` wrapper único (Sheet em mobile, Dialog em desktop).
2. Sticky footer dirty em forms de cadastros restantes.
3. Filtros bottom-sheet em Estoque, Logística, Compras.
4. RelationalDrawerStack: breadcrumb + limite 3 níveis em mobile.
5. Bottom nav contextual por módulo ativo.
6. Revisão dedicada: Auditoria, Migração, Social.
