## Objetivo

Reescrever os manuais e tours guiados do sistema de Ajuda com profundidade real — cobrindo submódulos, abas, drawers, formulários, ações por linha e atalhos. Ampliar os tours para passar pelas funções principais que hoje ficam de fora (ex.: baixar título no Financeiro, criar orçamento no Comercial, faturar pedido, ajuste de estoque, conciliação OFX, recebimento na Logística, abas do drawer de cadastros).

## Escopo

**Módulos com manual + tour completo (Onda 1 — core):**
Dashboard, Orçamentos, Pedidos de Venda, Fiscal (NF-e), Estoque, Financeiro, Logística, Clientes, Produtos.

**Módulos com manual + tour curto (Onda 2 — secundários):**
Pedidos de Compra, Cotações de Compra, Fornecedores, Contas Bancárias, Conciliação, Fluxo de Caixa, Relatórios, Workbook, Apresentação Gerencial.

**Módulos com manual ampliado, sem tour (Onda 3 — auxiliares):**
Transportadoras, Funcionários, Sócios, Formas de Pagamento, Grupos Econômicos, Administração, Auditoria, Configurações.

## O que muda no conteúdo (manuais)

Cada `HelpEntry` dos módulos core passa a ter, no mínimo:
1. **Visão geral** — para que serve, onde se encaixa no fluxo do ERP.
2. **Estrutura da tela** — KPIs do topo, filtros, tabela, abas e drawer.
3. **Ações por linha** — botões inline, atalhos do drawer, regras de permissão.
4. **Formulário (Novo / Editar)** — abas do `FormModal`/página, campos obrigatórios, validações automáticas (CNPJ, CEP, NCM), regras de tributação.
5. **Ciclo de vida e status** — transições permitidas, quem pode mudar status, efeitos colaterais (estoque, financeiro, fiscal).
6. **Excluir × Inativar × Cancelar** — árvore de decisão por entidade.
7. **Integrações** — para onde a ação leva (Financeiro gera título, Pedido baixa estoque, NF-e dispara SEFAZ, etc.).
8. **Atalhos e dicas** — `Ctrl+N`, `?`, navegação por número.

## O que muda nos tours guiados

Hoje cada tour tem 2 passos (filtros + tabela). Vamos para **5–8 passos por módulo core**, cobrindo:

- **Dashboard:** período global → bloco comercial → financeiro → fiscal → logística → drill-down explicativo (passo "fantasma" sem alvo).
- **Orçamentos:** filtros → tabela → ações inline (Enviar/Aprovar/Converter) → botão "Novo" → drawer (abas Geral/Itens/Rentabilidade) → conversão em pedido.
- **Pedidos:** filtros → tabela → ações inline → botão "Novo" → drawer → faturar (NF-e) → cancelar com motivo.
- **Fiscal:** seletor entrada/saída → filtros → tabela → status SEFAZ → ações (DANFE/XML/CC-e/Cancelar) → botão "Nova nota" → drawer → contingência.
- **Estoque:** abas (Saldos/Movimentações/Ajuste) → filtros → tabela → drill no produto → ajuste manual com motivo.
- **Financeiro:** alternância Lista/Calendário → KPIs (a vencer/vencidos/parciais/pagos clicáveis) → filtros → tabela → ações inline (Baixar/Estornar/Editar/Cancelar) → botão "Novo Lançamento" → modal → conciliação relacionada.
- **Logística:** abas Entregas/Recebimentos/Remessas → filtros → cards/linhas → rastreio em massa → drawer da remessa (eventos, etiqueta, transições postado→trânsito→entregue) → recebimento de compra.
- **Clientes:** filtros → tabela → botão "Novo" → drawer/modal com abas (Dados/Contatos/Endereço/Comercial/Comunicações) → ViaCEP/CNPJ → condições comerciais (desconto máximo).
- **Produtos:** filtros → tabela → botão "Novo" → modal com abas (Dados/Estoque/Fiscal/Compras/Obs) → tributação (NCM/CEST/CST) → fornecedores vinculados → composição/preço sugerido.

Tours secundários ganham 2–3 passos em vez de zero (filtros, tabela, ação principal).

## Âncoras `data-help-id` adicionais necessárias

Hoje só existem `*.filtros`, `*.tabela`, `*.tabs` e blocos do dashboard. Para o tour novo cobrir as ações principais, vamos **adicionar** estes anchors (o resolver já lida com `CSS.escape`):

| Página | Novos anchors |
|--------|---------------|
| `Index.tsx` | `dashboard.logistica` |
| `Orcamentos.tsx` | `orcamentos.novoBtn`, `orcamentos.acoesLinha` (no `<tbody>` ou wrapper das ações) |
| `Pedidos.tsx` | `pedidos.novoBtn`, `pedidos.acoesLinha` |
| `Fiscal.tsx` | `fiscal.tipoSeletor`, `fiscal.novoBtn`, `fiscal.acoesLinha` |
| `Financeiro.tsx` | `financeiro.viewToggle` (Lista/Calendário), `financeiro.kpis`, `financeiro.novoBtn`, `financeiro.acoesLinha` |
| `Estoque.tsx` | `estoque.ajusteBtn` (botão atalho de ajuste) |
| `Logistica.tsx` | `logistica.bulkRastrear`, `logistica.cardAcoes` |
| `Clientes.tsx` | `clientes.novoBtn` |
| `Produtos.tsx` | `produtos.novoBtn` |

Como `ModulePage` renderiza o botão "Novo" centralmente, vamos adicionar `data-help-id` via prop opcional no `ModulePage` (ou envolver o `ModulePage` num `<div data-help-id="...">`, alternativa mais simples e sem refatoração). Optaremos pelo wrapper `<div>` quando o `ModulePage` não suportar a prop.

## Detalhes técnicos

- **Sem mudança de tipos**: `HelpEntry`/`HelpTourStep` já comportam o conteúdo expandido. Apenas `version` é incrementado em cada entrada para reativar o `FirstVisitToast` para usuários que já dispensaram a versão anterior.
- **Passos "fantasma"**: o `CoachTour` já suporta steps cujo `target` não resolve (centraliza). Vamos usá-los para conceitos que não têm âncora visual única (ex.: "drill-down clica em qualquer KPI").
- **Sem nova migration**: o `useHelpProgress` persiste `lastSeenVersion` por rota — bump de versão basta.
- **Sem mudança no `HelpDrawer`/`HelpMenu`/`Ajuda.tsx`**: eles renderizam a partir do registry; conteúdo mais longo é absorvido naturalmente (já tem scroll).
- **Ordem de execução**:
  1. Adicionar os `data-help-id` que faltam nas 9 páginas core.
  2. Reescrever `src/help/entries/{dashboard,orcamentos,pedidos,fiscal,estoque,financeiro,logistica,clientes,produtos}.ts` com manual expandido + tour 5–8 passos + `version` incrementado.
  3. Expandir manuais e adicionar tour curto em `lote2.ts`.
  4. Expandir manuais em `lote3.ts` (sem tour).
  5. Smoke manual: para cada rota tocada, verificar visualmente se cada passo do tour aponta para um alvo existente; ajustar onde necessário.

## Entregáveis

- 9 arquivos de entry core reescritos.
- `lote2.ts` e `lote3.ts` ampliados.
- Anchors injetados em 9 páginas.
- Memória de produto atualizada com a doutrina de "manual completo + tour ≥5 passos por módulo core" (arquivo curto em `mem://produto/manual-tour-cobertura.md`).

## Não está no escopo

- Mudanças no motor do tour (`CoachTour.tsx`), no drawer de ajuda, nos hotkeys ou na página `/ajuda`.
- Tradução para outros idiomas.
- Tours em telas de formulário standalone (`OrcamentoForm`, `PedidoForm`, `RemessaForm`, `PedidoCompraForm`, `CotacaoCompraForm`) — neste momento só manuais cobrem essas telas.
