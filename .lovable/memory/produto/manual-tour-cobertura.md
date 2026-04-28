---
name: Manual e Tour - Cobertura
description: Doutrina de cobertura mínima dos manuais e tours guiados por módulo
type: feature
---
- Manuais dos módulos core (Dashboard, Orcamentos, Pedidos, Fiscal, Estoque, Financeiro, Logistica, Clientes, Produtos) cobrem: visão geral, estrutura da tela, ações por linha, formulário/drawer com abas, ciclo de vida, excluir×inativar×cancelar, integrações.
- Tour de módulo core: mínimo 5 passos, máximo ~8. Pode usar steps "fantasma" (target vazio → centraliza) para conceitos sem âncora.
- Anchors `data-help-id` padrão por página: `*.filtros`, `*.tabela`, `*.tabs` (quando há), `*.novoBtn` (botão Novo via prop `addButtonHelpId` do ModulePage), KPIs/toggles quando úteis.
- Bump de `version` é obrigatório quando manual/tour muda — reativa o FirstVisitToast.
- Lote 2 (secundários): manual aprofundado + tour curto (1–3 passos, pode ser fantasma).
- Lote 3 (auxiliares): manual ampliado, sem tour.
