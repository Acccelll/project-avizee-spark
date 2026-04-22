

# Revisão técnica e funcional — Módulo Dashboard

## 1. Visão geral do módulo

O Dashboard é a tela inicial (`/`, `src/pages/Index.tsx`) renderizada dentro do `AppLayout`. É composto por:

- `DashboardHeader` (saudação, período global, botão atualizar, menu Personalizar)
- Faixa de boas-vindas com vencimentos do dia
- KPIs financeiros (3 cards: Receber, Pagar, Saldo Projetado)
- Indicadores operacionais (4 cards: Estoque Crítico, Pedidos a Faturar, Compras Atrasadas, Remessas Atrasadas)
- `AlertStrip` (pílulas filtradas pelas exceções com `count > 0`)
- `FinanceiroBlock` (4 indicadores + `FluxoCaixaChart` embutido + linha "Hoje")
- `QuickActions` (6 atalhos)
- `VendasChart` (faturamento mensal — janela fixa 6 meses) + `PendenciasList`
- `ComercialBlock` + `EstoqueBlock`
- `LogisticaBlock` + `FiscalBlock`
- `ViewDrawerV2` para drill-down de Receber / Estoque (gráfico diário + top itens)

Camada de dados: 5 hooks por domínio (`useDashboardFinanceiroData`, `Comercial`, `Estoque`, `Fiscal`, `Aux`) consolidados em `useDashboardData` via React Query, mais `useDashboardKpis` e `useDashboardDrawerData`. Período global vem de `DashboardPeriodContext` (5 presets + custom validado).

## 2. Pontos fortes

- Boa separação por hook/domínio; React Query com `staleTime` e refetch manual no header.
- `ScopeBadge` deixa explícito quando um bloco respeita o período global ou usa janela fixa/snapshot — raro em ERPs.
- `BlockErrorBoundary` por bloco evita que falha de um quebre o resto da tela.
- `LazyInViewWidget` + `lazy()` no `VendasChart` reduzem custo inicial.
- Drilldown centralizado em `src/lib/dashboard/drilldown.ts` (intent → URL).
- KPIs operacionais separados dos financeiros, com tipografia e cor coerentes via `SummaryCard`.
- Sparklines no Receber/Pagar/Saldo já calculadas a partir da janela `next-7d`.
- `AlertStrip` ordena por severidade e some quando não há exceções (estado vazio positivo).

## 3. Problemas encontrados

### A. Personalização de layout é parcial / enganosa
- `useDashboardLayout` persiste `order` em `user_preferences`, e `DashboardCustomizeMenu` mostra setas ↑/↓ que disparam `moveWidget`.
- Mas `Index.tsx` ignora `prefs.order`: a ordem visual é JSX hardcoded. Setas mudam a ordem **só dentro do popover**, não no dashboard. Promessa de UX quebrada.
- O reorder é salvo mas nunca lido para render.

### B. Drilldown quebrado para "Pedidos a faturar"
- `buildDrilldownUrl({kind:'pedidos:aguardando-faturamento'})` → `/pedidos?faturamento=aguardando,parcial`.
- `Pedidos.tsx` usa `searchParams.getAll("faturamento")`, esperando `?faturamento=aguardando&faturamento=parcial`. O comma-joined vira `["aguardando,parcial"]`, que não bate com o status real.
- Resultado: card KPI "Pedidos a Faturar" e botão "Ver pedidos" no Comercial levam para uma listagem **com filtro silenciosamente vazio**.

### C. KPI "Pedidos a Faturar" e "Backlog OVs" usam universo distinto da listagem
- Hook conta `ordens_venda` com `status in (aprovada,em_separacao)` AND `status_faturamento in (aguardando,parcial)` — não respeita o período global.
- `Pedidos.tsx` por padrão lista TODAS as ordens. Mesmo se o filtro funcionasse, número e listagem usam fronteiras diferentes (sem range, sem coerência com o badge "Snapshot" que sequer aparece nesse KPI).

### D. "Orçamentos em aberto" mistura históricos importados
- `useDashboardComercialData` filtra apenas por `data_orcamento ∈ range` e `status ∈ (rascunho,pendente,aprovado)`. Não exclui `origem='importacao_historica'` (ou status `historico`).
- Como os 203 históricos foram importados com status `historico`, eles ficam fora desse filtro de status — OK para a contagem.
- Porém `recentOrcamentos` (lista "Últimos Orçamentos") **não filtra por status**. Para usuários cujo período inclui as datas históricas, o widget mostra `ORC100xxx` antigos. Isso polui o dia-a-dia comercial.

### E. Quick Actions "prometem" formulários, mas alguns levam só à listagem
- `nova-cotacao` → `/orcamentos/novo` ✅
- `novo-pedido-compra` → `/pedidos-compra/novo` ✅
- `nova-nota-saida` → `/fiscal?tipo=saida&new=1` ✅ (Fiscal escuta `new=1`)
- `novo-cliente` → `/clientes?new=1` — verificar se Clientes escuta `new=1` (padrão é só listagem)
- `novo-produto` → `/produtos?new=1` — idem
- `baixa-financeira` → `/financeiro` — **abre só a listagem**. Título diz "Baixa Financeira" mas não abre dialog de baixa lote/parcial. UX desonesta.

### F. Período global tem coerção semântica frágil
- `DashboardPeriodContext` só conhece: `today | week | month | 30d | custom`. Default = `30d`.
- Mas `PeriodFilter.tsx` (componente reutilizado em `Auditoria` e `Financeiro`) usa **outro vocabulário**: `hoje | 7d | 15d | 30d | 90d | year | todos | vencidos`.
- Existem dois conceitos de período no código com nomes diferentes. Risco enorme de divergência futura.
- `DashboardHeader` exibe um `<Select>` (não o `PeriodFilter`), então o componente `PeriodFilter` do dashboard **só é consumido por outras telas**. Componente vive em `components/dashboard/` mas pertence a outro contexto. Dívida.

### G. Skeleton fora de fase com layout real
- `DashboardSkeleton` desenha 4 KPI cards no topo (`grid-cols-4`), mas os KPIs reais são 3 cards (`grid-cols-3`). Layout pisca ao trocar do skeleton para o conteúdo.
- Skeleton não desenha a faixa de "indicadores operacionais" (4 cards extras), nem o widget "Vendas / Pendências".

### H. `FluxoCaixaChart` ignora o período global
- Sempre carrega últimos 6 meses, sem `useEffect` reativo a `range`.
- Está dentro de `FinanceiroBlock`, que ostenta `ScopeBadge('global-range')` no header. Conflito visual: o usuário espera o gráfico acompanhar o filtro mas ele não acompanha.

### I. `VendasChart` semi-respeita o período
- Usa `range.dateTo` como limite superior, mas força `dateFrom` para 6 meses atrás. A janela fixa colide com o `Sub-título "(janela fixa)"` (correto), mas o `dateTo` mutável pode produzir gráfico cortado quando o usuário escolhe "Hoje" — no `today` filtra `data_emissao <= hoje`, ok. Já em "custom" no passado, o gráfico **trunca o futuro** sem aviso.
- Sem `loading` state controlado por React Query (usa `useState` próprio), inconsistente com o resto.

### J. Pendências reduz a janela do período
- `PendenciasList` aplica `clamp` em `[hoje-60d, hoje+7d]` mesmo se o usuário escolhe `Custom 90 dias atrás → hoje`.
- Comportamento intencional comentado, mas usuário não sabe — `ScopeBadge` poderia indicar isso e não indica (o widget não tem badge).

### K. Cards do Drawer de drill-down só existem para Receber e Estoque
- `setMetricDrawer` aceita só `"receber" | "estoque"`.
- Pagar, Saldo, Pedidos a faturar, Compras atrasadas, Remessas atrasadas têm `onClick` apenas para navegação. Sem detail equivalente. Maturidade desigual.

### L. "Saldo Projetado" e "Variação vs mês anterior" sem semântica
- `saldoProjetado = totalReceber - totalPagar` em **toda a janela**, não em "saldo final do período".
- KPI "Contas a Pagar" mostra `variation` "Saldo positivo/negativo" — frase errada para o card de A Pagar (a variação deveria ser sobre o próprio total). Confunde o leitor.
- Faturamento mês anterior é coletado mas **nunca exibido** (`faturamento.mesAnterior` calculado e descartado).

### M. Componentes inconsistentes / parcialmente legacy
- `PeriodFilter.tsx` e `periodTypes.ts` vivem em `components/dashboard/` mas o dashboard atual não os usa.
- `DashboardCard` é usado em 2 widgets (Vendas e Pendências) mas Financeiro/Comercial/Estoque/Logística/Fiscal usam div ad-hoc com `bg-card rounded-xl border`. Sem padronização de wrapper.

### N. Refetch parcial / sem invalidação cruzada
- "Atualizar" chama `query.refetch()` da queryKey `["dashboard", from, to]`. Mas `FluxoCaixaChart`, `VendasChart` e `PendenciasList` usam queries próprias / `useEffect` com keys diferentes e não são invalidadas no botão. Atualização parcial visível.

### O. Indicadores operacionais não têm `ScopeBadge`
- Diferente dos blocos, os 4 cards operacionais não comunicam que são snapshot. Inconsistente com a tese do `ScopeBadge`.

### P. KPIs grandes sem `aria-live`
- Atualizações automáticas ao trocar período não são anunciadas para leitores de tela. Pequena dívida de acessibilidade.

## 4. Problemas prioritários

1. **B** — Drilldown quebrado de "Pedidos a faturar" (`?faturamento=aguardando,parcial`) → KPI inutilizável. **Crítico**.
2. **A** — Personalização promete reordenar e não reordena. Funcionalidade morta visível ao usuário.
3. **D** — Históricos importados aparecendo no widget "Últimos Orçamentos" do dashboard.
4. **L** — `variation` errada no card "A Pagar" e `faturamento.mesAnterior` nunca exibido.
5. **H** — Fluxo de Caixa ignora o período global mas está dentro de bloco que ostenta o badge "global-range".
6. **E** — Quick Actions "Baixa Financeira", "Novo Cliente", "Novo Produto" não abrem o flow prometido.

## 5. Melhorias de UI/UX

- Ajustar `DashboardSkeleton` para corresponder à grade real (3 KPIs + 4 operacionais + bloco vendas/pendências).
- Adicionar `ScopeBadge` aos 4 cards operacionais (todos são snapshot).
- Faixa de saudação: usar nome correto (`profile?.nome_completo` se existir) e ocultar quando vazio.
- "Hoje" no `FinanceiroBlock` aparece só se houver vencimentos; quando aparece, embute "Ver fluxo de caixa →" — duplica o CTA do header. Consolidar.
- `QuickActions`: renomear "Baixa Financeira" para "Lançamentos" enquanto não houver dialog dedicado, ou abrir o `BaixaLoteModal` com query param.
- Drawer de drill-down: estender para Pagar e Saldo Projetado (compartilham mesmo dataset diário).
- Linha "indicadores operacionais": título poderia ser mais semântico — "Exceções operacionais" deixa claro que ali é onde falhas vivem.
- `VendasChart`: dropdown de janela (3/6/12 meses) ao invés de janela fixa silenciosa.
- `PendenciasList`: indicar a janela aplicada (`próximos 7 dias / período X`) com chip — está implícito no `staleTime` mas o usuário não vê.
- `AlertStrip` quando vazio é "Nenhum alerta operacional" — bom, mas poderia trazer hora da última verificação.
- Padronizar wrappers em `DashboardCard` para todos os blocos (Financeiro/Comercial/Estoque/Logística/Fiscal hoje usam div solta).

## 6. Melhorias estruturais

- Mover `PeriodFilter`/`periodTypes` para fora de `components/dashboard/` (eles servem outras telas) e unificar vocabulário com `DashboardPeriod`.
- `useDashboardLayout` deveria realmente comandar a ordem do JSX em `Index.tsx` via `prefs.order.map(id => RENDERERS[id])`. Hoje há divergência entre o catálogo (`WIDGET_REGISTRY`), a ordem persistida (`prefs.order`) e a ordem real (JSX).
- Drilldown: adicionar testes/garantias de que cada `DrilldownIntent` chega numa página que entende os params (lint/contrato), e usar `searchParams.append` consistente (sempre param-único OU sempre comma-joined — escolher um).
- Centralizar todas as queries do dashboard sob a mesma queryKey raiz (`["dashboard", ...]`) para que o botão "Atualizar" invalide tudo (Fluxo, Vendas, Pendências inclusive).
- Excluir `origem='importacao_historica'` em queries comerciais que alimentam KPIs/widgets do dashboard, alinhando com o filtro default já feito em `Orcamentos.tsx`.
- Inverter dependência: blocos não devem chamar Supabase direto (`FluxoCaixaChart`, `VendasChart`, `PendenciasList`) — devem receber dados do `useDashboardData` como os demais. Isso elimina duplicação de período e inconsistência de cache.
- Tipar `WidgetId` em `useDashboardLayout` e `WIDGET_REGISTRY` em sincronia (hoje precisa adicionar manual em 2 lugares + DEFAULT_ORDER).

## 7. Prompt corretivo "Para o Lovable"

> Aplique correções estruturais no Dashboard (banco / queries / contratos):
>
> 1. **Excluir históricos do comercial do dashboard**: em `src/pages/dashboard/hooks/useDashboardComercialData.ts`, adicionar `.neq('origem','importacao_historica')` em **todas** as queries de `orcamentos` (contagem de abertos e `recentOrcamentos`). Mesmo critério já usado em `Orcamentos.tsx`.
>
> 2. **Padronizar contrato de filtros multivalor nas listagens**: escolher um padrão único (recomendo comma-joined `?faturamento=aguardando,parcial`) e ajustar `src/pages/Pedidos.tsx` para parsear `searchParams.get("faturamento")?.split(",")` em vez de `getAll`. Reaproveitar a mesma lógica usada em `Financeiro` (`status.split(",")`). Atualizar `buildDrilldownUrl` se decidir o oposto. Documentar a convenção em `src/lib/dashboard/drilldown.ts`.
>
> 3. **Unificar fonte de período**: mover `PeriodFilter` e `periodTypes` para `src/components/filters/` e renomear o tipo `Period` para algo distinto de `DashboardPeriod`. Criar adapter `dashboardPeriodToPeriod()` para reuso correto.
>
> 4. **Centralizar queries do dashboard**: refatorar `FluxoCaixaChart`, `VendasChart` e `PendenciasList` para receberem dados via props vindos de hooks novos `useDashboardFluxoCaixa`, `useDashboardVendas`, `useDashboardPendencias` consumidos por `useDashboardData`. Todos sob a mesma queryKey raiz para que `loadData()` (botão Atualizar) refete a página inteira.
>
> 5. **Layout customizável real**: em `src/pages/Index.tsx`, criar `RENDERERS: Record<WidgetId, () => ReactNode>` e renderizar `prefs.order.filter(id => !prefs.hidden.includes(id)).map(id => RENDERERS[id]())`. Manter os agrupamentos visuais (linhas) via metadado em `WIDGET_REGISTRY` (`row?: number; span?: 'half' | 'full' | 'third'`) ou aceitar reorder linear simples para v1.
>
> 6. **Faturamento mês anterior visível**: já é calculado em `useDashboardComercialData`. Adicionar no `ComercialBlock` ou em um KPI dedicado a variação MoM com `((mesAtual - mesAnterior)/mesAnterior)*100`.
>
> 7. **Saldo projetado coerente**: anotar no `subtitle` que se trata de "soma da janela", não saldo final de caixa. Se a intenção for saldo final, mudar fórmula para `saldoBancarioAtual + receberJanela - pagarJanela`.
>
> 8. **Aviso explícito no `FluxoCaixaChart`**: ou tornar reativo ao `range` global, ou trocar o `ScopeBadge` do `FinanceiroBlock` para indicar que o gráfico é janela fixa de 6 meses (já que os 4 indicadores acima são global-range, mostrar dois badges).

## 8. Prompt corretivo "Para o Copilot/Codex"

> Ajustes de UI/UX/código no Dashboard, sem mexer em banco ou queries de domínio:
>
> 1. **Skeleton coerente** (`src/components/dashboard/DashboardSkeleton.tsx`): trocar `grid-cols-4` para `grid-cols-3` no bloco de KPIs e adicionar uma faixa para os 4 cards operacionais (`grid-cols-2 sm:grid-cols-4`). Adicionar 2 cards lado-a-lado para a linha "Vendas + Pendências".
>
> 2. **Indicadores operacionais com `ScopeBadge`**: em `src/pages/dashboard/hooks/useDashboardKpis.ts`, adicionar campo `scope?: ScopeKind` aos itens de `operationalCards`. Em `Index.tsx`, renderizar o badge dentro do `SummaryCard` (ou ao lado do título da seção). Todos como `{ kind: 'snapshot' }`.
>
> 3. **`QuickActions` mais honestos**:
>    - Renomear "Baixa Financeira" para "Ir para Financeiro" enquanto não houver atalho de dialog. Alternativa: trocar `path` para `/financeiro?baixa=lote` e tratar esse param em `Financeiro.tsx` para abrir `BaixaLoteModal` automaticamente.
>    - Validar que `?new=1` em `/clientes` e `/produtos` realmente abre o form. Se não abrir, ou implementar handler ou rotular como "Abrir Clientes" / "Abrir Produtos".
>
> 4. **Personalização visual coerente** (depende do refator do Lovable item 5): enquanto `prefs.order` não comandar render, ocultar as setas ↑/↓ no `DashboardCustomizeMenu` para não vender funcionalidade que não existe; manter apenas toggle de visibilidade.
>
> 5. **Card "A Pagar" com variation correta** (`useDashboardKpis.ts`): trocar `variation` de "Saldo positivo/negativo" (que é narrativa de saldo, não de pagar) para algo como `${formatNumber(stats.contasPagar)} título(s)` ou comparativo período anterior. Mesma revisão para "A Receber" — hoje usa "X vencidos" o que é coerente.
>
> 6. **`Index.tsx` consistência de wrapper**: passar `FinanceiroBlock`, `ComercialBlock`, `EstoqueBlock`, `LogisticaBlock`, `FiscalBlock` para usar `<DashboardCard>` como Vendas/Pendências, e remover o `bg-card rounded-xl border` interno desses componentes (mover styling para `DashboardCard`).
>
> 7. **Drill-down drawer simétrico**: estender `metricDrawer` em `Index.tsx` para aceitar `"pagar" | "saldo"` reaproveitando `dailyPagar`. Ajustar `useDashboardDrawerData` para expor essas chaves. Mostrar o botão "ver detalhe" (lupa) também nos cards de Pagar e Saldo via `onDetail` em `useDashboardKpis`.
>
> 8. **`PendenciasList` mostra janela aplicada**: adicionar header pequeno tipo `Próximos 7 dias` (ou texto baseado em `range`) usando `ScopeBadge`.
>
> 9. **`VendasChart` sem `useEffect`+`useState`**: migrar para `useQuery(['dashboard','vendas',range.dateTo], ...)` com `staleTime: 2 * 60_000`. Mesmo padrão para `FluxoCaixaChart`. Isso corrige o "Atualizar" não invalidando esses gráficos.
>
> 10. **Acessibilidade**: adicionar `aria-live="polite"` no container de KPIs e operacionais para que mudanças de período sejam anunciadas. Garantir que botões de pílula no `AlertStrip` tenham `role="link"` (eles navegam, não disparam ação). Conferir contraste do `text-warning`/`text-info` nos badges.
>
> 11. **Faixa "indicadores operacionais"**: trocar título para "Exceções operacionais" (mais coerente com o conteúdo) e adicionar contador resumo `${total} exceções` à direita.
>
> 12. **Limpeza**: remover de `components/dashboard/` arquivos que não pertencem mais a esse contexto (`PeriodFilter.tsx`, `periodTypes.ts`) — mover para o destino que o Lovable definir no item 3 daquele prompt.

