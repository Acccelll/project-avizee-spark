## Objetivo
Corrigir o comportamento do filtro **Todos** e revisar todo o fluxo de filtros do Financeiro para garantir que interface, URL, KPIs e listagem paginada permaneçam consistentes.

## O que vou corrigir
1. **Fonte única de verdade dos filtros temporais**
   - Revisar a interação entre `PeriodFilter`, `MonthFilter`, `useFinanceiroFiltros` e `serverFilters`.
   - Garantir que **Todos** realmente remova qualquer recorte temporal e não herde status/período residual.
   - Garantir que `Mês` e presets de período se limpem de forma previsível.

2. **Consistência entre URL, UI e query server-side**
   - Auditar o mapeamento `useUrlListState` → `serverFilters` → RPCs.
   - Corrigir casos em que a URL mostra um estado, mas a consulta usa outro.
   - Revisar `onClearAll` para que limpar filtros também trate período/mês quando necessário, evitando filtros “escondidos”.

3. **Coerência entre listagem e KPIs**
   - Validar se `listar_financeiro_lancamentos_ids` e `kpis_financeiro` aplicam exatamente a mesma semântica de filtros.
   - Corrigir divergências de busca/status/período, especialmente para `todos`, `hoje`, `vencidos`, `aberto`, `parcial` e `pago`.

4. **Status efetivo e bugs de data**
   - Revisar a diferença entre a lógica client-side (`getEffectiveStatus`) e a lógica SQL (`CURRENT_DATE`).
   - Corrigir possíveis inconsistências de “vence hoje” vs “vencido” causadas por horário/local timezone.

5. **Interações quebradas ou frágeis dos componentes de filtro**
   - Corrigir problemas estruturais nos componentes de filtro que podem afetar clique/remoção de seleção.
   - Em especial, revisar `MultiSelect` e `AdvancedFilterBar`, onde já existem sinais de HTML inválido (`button` aninhado e badge interativa), que podem causar comportamento imprevisível.

6. **Cobertura de regressão**
   - Adicionar testes focados para garantir que:
     - `Todos` não aplique filtro temporal nem status residual.
     - `Hoje`, `7d`, `15d`, `30d`, `90d` e `Mês` gerem os parâmetros corretos.
     - KPIs e listagem usem a mesma interpretação de filtros.
     - filtros não fiquem “clicáveis visualmente, mas sem efeito”.

## Principais problemas já identificados
- O filtro **Todos** pode continuar limitado por **status residual** vindo da URL/estado anterior.
- Há forte chance de **desalinhamento entre o que o chip mostra e o que a RPC realmente recebe**.
- `onClearAll` hoje limpa só filtros do `AdvancedFilterBar`, mas não trata o recorte temporal principal (`period`/`mes`).
- Existe inconsistência potencial entre o cálculo client-side de status efetivo e a derivação no SQL.
- Há warnings de estrutura inválida em componentes de filtro (`button` dentro de `button`), que podem interferir com cliques e foco.

## Entregáveis
- Correção do comportamento do filtro **Todos**.
- Revisão e ajuste dos filtros temporais, de status e limpeza total.
- Ajustes estruturais nos componentes de filtro que estiverem causando interação quebrada.
- Testes de regressão cobrindo os cenários críticos.

## Detalhes técnicos
- Arquivos mais prováveis de ajuste:
  - `src/pages/Financeiro.tsx`
  - `src/pages/financeiro/hooks/useFinanceiroFiltros.ts`
  - `src/pages/financeiro/hooks/useFinanceiroLancamentosPaged.ts`
  - `src/pages/financeiro/hooks/useFinanceiroKpisRpc.ts`
  - `src/services/financeiro/listagem.ts`
  - `src/components/filters/PeriodFilter.tsx`
  - `src/components/filters/MonthFilter.tsx`
  - `src/components/ui/MultiSelect.tsx`
  - `src/components/AdvancedFilterBar.tsx`
  - testes unitários/integrados relacionados ao Financeiro
- Se eu encontrar divergência de semântica nas RPCs, incluo uma migração para alinhar backend e frontend.

## Validação
Vou validar o resultado conferindo:
- URL final gerada por cada filtro.
- requests enviados para listagem e KPIs.
- contagem total vs registros exibidos.
- interação dos chips e multiselects sem warnings estruturais nos pontos corrigidos.