## Problema

O KPI "A receber em aberto" do dashboard hoje aplica `data_vencimento ∈ [from, to]`. Como `to` é sempre ≤ hoje, todos os títulos com vencimento futuro ficam de fora e o valor exibido se aproxima apenas dos vencidos. O drill-down reproduz o mesmo erro, levando para uma listagem que mostra "só vencidos".

## Decisão (confirmada com o usuário)

KPIs de saldo em aberto (A Receber, A Pagar, Vencidas) são **snapshot atual** — não respeitam o período global do dashboard. O período global continua valendo para o que faz sentido (faturamento, recebimentos no dia, gráficos diários, top clientes do período).

## Mudanças

### 1. `src/pages/dashboard/hooks/useDashboardFinanceiroData.ts`
Remover `gte/lte` em `data_vencimento` das queries `buildTotalQuery("receber")` e `buildTotalQuery("pagar")`. Ficam como snapshot puro: `tipo + ativo + status IN (aberto, parcial, vencido)`.

A consulta `vencidasResult` já é snapshot — sem alteração.

`recDataResult` (top clientes) **mantém** o filtro de período: top clientes do período faz sentido.

`dailyReceber`/`dailyPagar` continuam restritos aos próximos 7 dias (já são snapshot futuro independente do período).

### 2. `src/components/dashboard/FinanceiroBlock.tsx`
- Trocar o `ScopeBadge` do header de `{ kind: 'global-range', eixo: 'data_vencimento' }` para um scope "snapshot" (ver passo 3).
- Adicionar um pequeno texto/badge distinguindo os indicadores: "A receber / A pagar / Vencidas = snapshot atual", e o gráfico/Top continua marcado como "período global".

### 3. `src/components/dashboard/ScopeBadge.tsx`
Adicionar variante `{ kind: 'snapshot' }` que renderiza um chip "Snapshot atual" (tooltip: "Saldo atual em aberto — não respeita o filtro de período do dashboard"). Usar essa variante nos indicadores A Receber, A Pagar e Vencidas.

### 4. `src/lib/dashboard/drilldown.ts`
Remover o parâmetro `range` das intents `financeiro:receber-aberto`, `financeiro:pagar-aberto` e `financeiro:vencidos`. A URL volta a ser:
- `/financeiro?tipo=receber&status=aberto,parcial,vencido`
- `/financeiro?tipo=pagar&status=aberto,parcial,vencido`
- `/financeiro?status=vencido`

Atualizar a tabela-doutrina do topo do arquivo registrando "snapshot, sem janela".

### 5. `src/pages/Index.tsx`, `src/components/dashboard/KpiDetailDrawer.tsx`, `src/components/dashboard/FinanceiroBlock.tsx`
Remover o `range: globalRange` passado para `buildDrilldownUrl` nos intents financeiros (adicionado na rodada anterior). Remover `useGlobalPeriod()` desses componentes se não for usado em outro lugar.

### 6. `src/pages/financeiro/hooks/useFinanceiroFiltros.ts`
**Manter** o suporte a `?from=&to=` lido da URL (foi adicionado na rodada anterior). É inofensivo quando não há params e fica disponível para outros call-sites que queiram passar janela explícita.

### 7. `src/components/dashboard/AlertStrip.tsx`
A intent `financeiro:vencidos` é usada aqui também — passa a não receber range (consistente com o item 4).

## Verificação após implementação

1. Dashboard com período global = "Mês": "A Receber" passa a mostrar **todos** os títulos em aberto (inclui vencimentos futuros), não só os do mês.
2. Clicar no card "A receber" abre `/financeiro?tipo=receber&status=aberto,parcial,vencido` (sem from/to). A listagem mostra os 52 + 3 títulos.
3. ScopeBadge do bloco mostra "Snapshot atual" nos indicadores de saldo; gráfico/Top continua "global-range".
4. Mudar o período global no header **não altera** os valores A Receber/A Pagar/Vencidas, só faturamento e gráficos de período.

## Fora de escopo

- Não muda banco de dados (sem migration).
- Não muda KPIs de faturamento, recebimentos no dia, gráficos diários ou Top clientes — todos seguem respeitando o período global, que é o comportamento correto neles.
- Não toca outros módulos.
