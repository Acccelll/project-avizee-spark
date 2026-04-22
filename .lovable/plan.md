

# Revisão Técnica e Funcional — Módulo Dashboard (`/`)

Revisão baseada no estado real dos arquivos (`src/pages/Index.tsx`, `src/pages/dashboard/hooks/*`, `src/components/dashboard/*`, `src/hooks/useDashboardLayout.ts`, `src/lib/dashboard/*` e integrações com módulos de origem).

---

## 1. Visão geral do módulo

O Dashboard (`/`) é a tela inicial do ERP. É composto por:

- **Header** (`DashboardHeader`) — título, data/hora, seletor de período global (Hoje / Esta semana / Este mês / Últimos 30 dias / Personalizado) com aplicação manual via botão "Aplicar", botão Atualizar e menu Personalizar.
- **Saudação contextual** ("Bom dia, X · vencimentos hoje · pedidos a faturar").
- **Linhas de widgets** ordenadas por preferência do usuário (`useDashboardLayout` + `user_preferences.dashboard_layout_v1`):
  - `kpis` (3 cards: Receber, Pagar, Saldo Projetado)
  - `operational` (4 cards: Estoque Crítico, Pedidos a Faturar, Compras em Atraso, Remessas Atrasadas)
  - `alertas` (`AlertStrip` — pílulas clicáveis por severidade)
  - `financeiro` + `acoes_rapidas` (par)
  - `vendas_chart` + `pendencias` (par)
  - `comercial` + `estoque` (par)
  - `logistica` + `fiscal` (par)
- **Drawer de detalhe** (`ViewDrawerV2`) abre em "Detalhar" dos KPIs Receber/Pagar/Saldo/Estoque com 2 abas (Evolução diária + Top itens).
- **Dados** centralizados em `useDashboardData` (React Query, key `["dashboard", dateFrom, dateTo]`, staleTime 2min) que orquestra 5 sub-hooks (financeiro, comercial, estoque, fiscal, aux) com `Promise.all`.
- **Drill-down** padronizado por `buildDrilldownUrl` (`src/lib/dashboard/drilldown.ts`) com 11 intents.

---

## 2. Pontos fortes

- **Camada de dados modularizada e cacheada**: `useDashboardData` divide em hooks por domínio, com React Query (key por range, gcTime 5min, retry controlado, sem refetch em focus). Uso correto de `Promise.all` paralelizando 5 cargas.
- **`buildDrilldownUrl` centraliza intents** — toda navegação usa o mesmo padrão multivalor (`?status=aberto,parcial,vencido`), evitando query strings ad-hoc.
- **`ScopeBadge` é uma boa decisão de produto** — explicita ao usuário que blocos têm escopos temporais distintos (snapshot, fixed-window, global-range), com tooltip semanticamente claro.
- **Diferenciação correta KPIs financeiros vs. operacionais** em `useDashboardKpis`: cards de valor têm meta+sparkline; cards operacionais nunca têm meta/sparkline (`scope: snapshot`).
- **`backlogOVsCount` e `comprasAtrasadasCount` são contagens reais** (queries `head: true, count: 'exact'`) e não derivadas das listas preview limitadas — evita o clássico bug de "12+" em badges.
- **Acessibilidade básica** presente: `aria-live="polite"` nas grids de cards, `aria-label` em botões, `figure/figcaption` no `VendasChart`, skeletons em todos os blocos pesados.
- **Layout responsivo + lazy loading** com `LazyInViewWidget` e `Suspense` para `VendasChart`, `LogisticaBlock`, `FiscalBlock`.
- **Reconciliação automática do layout v1** quando novos widgets são adicionados — anexa ao final em vez de quebrar o que o usuário já personalizou.
- **Inclusão recente de `status='importada'`** em `VendasChart` e `useDashboardComercialData` corrige a invisibilidade do histórico migrado.

---

## 3. Problemas encontrados

### A. Coerência semântica dos KPIs

1. **KPI "Contas a Pagar" tem `variation` vazia/duplicada** (`useDashboardKpis.ts` L89-93): os dois ramos do ternário retornam o mesmo texto `"${contasPagar} título(s) no período"`. A variação não comunica nada — só ocupa espaço.
2. **KPI "Saldo Projetado" não respeita seu próprio rótulo**: o subtítulo diz "receber − pagar (janela)" mas a sparkline soma `dailyReceber[i] - dailyPagar[i]` dos próximos 7 dias (escopo `next-7d`, fixo), enquanto o `value` usa `totalReceber - totalPagar` do **range global**. São duas janelas diferentes em um único card.
3. **`stats.contasVencidas` é usado tanto no KPI Receber quanto influencia o `variant` do KPI Pagar** (L94: `stats.totalPagar > stats.totalReceber ? danger : warning`) — a regra de cor de "Pagar" depende do balanço com Receber, o que é confuso e não documentado.
4. **`ticketMedio` mistura escopos**: `faturamento.mesAtual / faturamento.nfAtualCount` é sempre **mês atual**, mas é exibido em `ComercialBlock` lado a lado com `cotacoesAbertas` e `pedidosPendentes` que respeitam o range global (cotações) ou são snapshot (pedidos). O usuário muda o período e o ticket médio não muda — sem indicação visual disso.

### B. Drill-down real vs. navegação genérica

5. **`Quick Actions` que prometem create flow mas só levam à listagem com `?new=1`**: 
   - `Novo Cliente` → `/clientes?new=1` (abre modal — ok, verificado em `Clientes.tsx`).
   - `Novo Produto` → `/produtos?new=1` (idem — ok).
   - `Nova Nota` → `/fiscal?tipo=saida&new=1` (ok — `Fiscal.tsx` trata).
   - `Baixa Financeira` → `/financeiro?baixa=lote` (ok — `Financeiro.tsx` trata).
   - **`Novo Orçamento` → `/orcamentos/novo`** e **`Novo Pedido` → `/pedidos-compra/novo`**: rotas dedicadas. Verificar consistência (alguns abrem modal, outros vão para página própria — UX inconsistente entre os 6 atalhos).
6. **`fiscal:pendentes` resolve para `?status=pendente,rascunho`** mas o módulo fiscal usa o status `rascunho` para nota não emitida. "Pendente" não é um status nativo de `notas_fiscais`. O drill-down pode renderizar 0 resultados quando o KPI mostra > 0.
7. **`compras:atrasadas` → `/pedidos-compra?atrasadas=1`** depende do filtro temporal do `PedidosCompra.tsx` (comentário do próprio código: "atrasado não é um status real, só uma interpretação"). Risco de o número do dashboard divergir do listado.
8. **KPI "Compras em Atraso" no `operational` block não tem `onDetail`** (drawer interno) — apenas navegação. Inconsistente com Receber/Pagar/Saldo/Estoque que têm os dois.

### C. Semântica do período global

9. **O período global filtra apenas alguns blocos** — Financeiro (vencimentos), Comercial (orçamentos/cotações), Fiscal (NFs emitidas) e contagem de Compras. **Não filtra**: Estoque (snapshot), Logística (snapshot), Pendências (janela fixa next-7d, exceto se range global presente), Vendas chart (sempre últimos 6 meses), `faturamento.mesAtual`, `vencimentosHoje`. O `ScopeBadge` mitiga, mas o usuário ainda muda o período e vê metade da tela parada — sem hint global.
10. **`PendenciasList` clampa o range global a `[hoje-60d, hoje+7d]`** silenciosamente. Se o usuário escolhe "Últimos 30 dias", funciona; se escolhe um custom range fora dessa janela, recebe lista vazia sem explicação.
11. **`vencimentosHoje` na saudação não respeita o período** — sempre é "hoje". Texto pode ficar conflitante quando o usuário está olhando "Este mês".

### D. Uso real da personalização de layout

12. **Reordenação por seta única** (up/down em `DashboardCustomizeMenu`) é funcional mas trabalhosa. Não há drag-and-drop apesar de o nome do hook (`useDashboardLayout`) e da migração legacy (`v3:` baseada em react-grid-layout) sugerirem ambição maior.
13. **Não é possível redimensionar widgets** — apenas mostrar/ocultar e reordenar. `DashboardLayoutItem` ainda exporta `x/y/w/h/minW/minH` mas **nenhuma chamada usa esses campos**. Código morto.
14. **Pares (`PAIR_GROUPS`)** quebram silenciosamente quando o usuário move um widget — o comentário avisa "vira full-width (comportamento gracioso)", mas o usuário não recebe nenhum hint visual de que o layout pareado foi quebrado.
15. **Persistência via `user_preferences`** OK, mas a migração legacy do `localStorage` v3 só salva `order` (descarta posições). Se o usuário tinha tamanhos customizados, são perdidos sem aviso.

### E. Componentes legacy / código morto

16. **`useDashboardLayout.ts` carrega o tipo `DashboardLayoutItem` e o `DEFAULT_LAYOUT` array** — não consumidos por nenhum componente atual. Resíduo da arquitetura `react-grid-layout` planejada.
17. **`DashboardCard` está sendo subutilizado** — só 2 widgets (`vendas_chart`, `pendencias`) usam. Os outros blocos têm seus próprios containers (`bg-card rounded-xl border ...`). Inconsistência: `FinanceiroBlock`, `ComercialBlock`, etc. duplicam o estilo do card em vez de usar o componente.
18. **`useDashboardDrawerData` exporta a chave `vendas`** que **não tem caso de uso ativo** — `metricDrawer` aceita só `"receber" | "pagar" | "saldo" | "estoque"`. Código morto.
19. **`Fragment` import + wrapper `<><DashboardSkeleton /></>` em `Index.tsx` L144-147** — sem motivo, fragment vazio dentro de fragment.
20. **`User` icon importado em `AlertStrip`** para representar "Pedidos a faturar" — semanticamente errado (deveria ser `ClipboardList` ou `FileText`; `User` sugere cliente/usuário).

### F. Consistência com módulos de origem

21. **`ComercialBlock` mostra "Cotações abertas"** filtradas por `OPEN_ORC_STATUSES = ['rascunho', 'pendente', 'aprovado']`. O módulo `Orcamentos` provavelmente usa "ativo + status != cancelado/convertido". Risco: clique no card leva a uma listagem com mais/menos itens do que o KPI prometeu.
22. **`backlogOVs` (`useDashboardComercialData`)** filtra `status IN ('aprovada', 'em_separacao')` + `status_faturamento IN ('aguardando', 'parcial')`. O drill-down `pedidos:aguardando-faturamento` envia `?faturamento=aguardando,parcial` **sem filtrar por status da OV**. Divergência potencial entre dashboard e listagem.
23. **`AlertStrip "Notas pendentes"`** → `fiscal:rascunho` (`?status=rascunho`), mas o KPI de origem (`fiscalStats.pendentes`) inclui a contagem de status `rascunho` apenas (verificável em `summarizeFiscalStats`). Está coerente, mas o label `"Notas pendentes"` não casa com `?status=rascunho` na URL — mensagem mista.
24. **`remessas` e `pedidos_compra` overdue**: `useDashboardAuxData` usa `today = new Date().toISOString().slice(0,10)` (UTC) como cutoff, enquanto o resto do app trabalha em horário local. Risco de off-by-one no timezone do Brasil (BRT-3).

### G. UI / UX / Visual

25. **`ViewDrawerV2` ainda é renderizado em `Index.tsx`** (L356-472) com 116 linhas de JSX inline — viola o padrão de migração para `pushView` aplicado nos demais módulos (Grupos, Formas, Transportadoras, Funcionários). Dashboard é o último consumidor direto.
26. **`Saldo Projetado` mostra "Caixa positivo / Caixa negativo"** como variação, mas não há contexto (vs. mês anterior? vs. meta?). Texto qualitativo redundante com a cor.
27. **`AlertStrip` e `operational cards` mostram informações sobrepostas** — "Estoque mínimo" aparece no AlertStrip E no card operacional "Estoque Crítico"; "Pedidos a faturar" idem; "Compras em atraso" idem; "Remessas atrasadas" idem. Quatro de seis pílulas do AlertStrip espelham os 4 cards operacionais. Tela carrega informação duplicada com visuais diferentes.
28. **Greeting inclui "👋"** no `formatVencimentosHoje` parent — único emoji da página, destoa do resto que segue Lucide-only.
29. **`DashboardHeader` não mostra o range efetivo** quando `period !== 'custom'`. Usuário em "Este mês" não vê quais datas estão sendo usadas.

---

## 4. Problemas prioritários

Ordem por risco x esforço:

1. **#25 — Migrar `ViewDrawerV2` do dashboard para `pushView`** ou para um drawer dedicado. É o último uso do padrão legacy no módulo; mantém divida arquitetural visível em 116 linhas.
2. **#9 + #11 — Coerência do período global**: ou (a) aplicar o range a TODOS os blocos passíveis, ou (b) adicionar um hint global no header listando "blocos afetados pelo período" + atualizar saudação para refletir o range.
3. **#27 — Eliminar duplicação AlertStrip × Operational Cards**: decidir uma fonte única (sugestão: manter cards operacionais coloridos + reduzir AlertStrip a alertas que não estejam nos cards, ex.: "Títulos vencidos" e "Notas pendentes").
4. **#6 + #21 + #22 — Alinhar filtros de drill-down com os filtros que produzem o KPI**: garantir que clicar em "Cotações abertas" abra a listagem com EXATAMENTE os mesmos status (`rascunho,pendente,aprovado`) — hoje nem todos os destinos respeitam o mesmo conjunto.
5. **#1 + #2 + #3 — Limpar a semântica dos KPIs**: corrigir variação duplicada do "Pagar"; alinhar janela do `value` e da `sparkline` no Saldo; remover o cross-coupling de `variant` Pagar↔Receber.
6. **#13 + #16 — Remover código morto** (`DashboardLayoutItem`, `DEFAULT_LAYOUT`, chave `vendas` em `useDashboardDrawerData`) e formalizar que personalização v1 é "ordenar + ocultar" (sem D&D, sem resize).
7. **#24 — Corrigir cutoff UTC** em `useDashboardAuxData` (remessas/compras atrasadas): usar `formatLocalDate` (que já existe em `DashboardPeriodContext`).

---

## 5. Melhorias de UI/UX

- **Header**: exibir o intervalo efetivo (ex.: "01–22 abr · Este mês") ao lado do label do período, sempre.
- **AlertStrip**: reduzir a 2-3 alertas únicos (vencidos, notas pendentes); deixar contagens operacionais nos cards.
- **Cards KPI**: mudar `variation` de "Pagar" para "X% do receber" ou "Y vencendo em 7d", trazendo informação útil.
- **Saldo Projetado**: subtítulo dinâmico ("janela: este mês" / "janela: 22/04–30/04") e sparkline na MESMA janela do `value`.
- **`vencimentosHoje` na saudação**: tornar clicável (link para `/financeiro?venc=hoje`).
- **`ComercialBlock` ticket médio**: badge `ScopeBadge "Mês atual"` específico para esse KPI.
- **Personalizar**: substituir setas up/down por drag-and-drop com `@dnd-kit` (já está no ecossistema React do projeto via shadcn) — esforço médio, ganho UX significativo. Ou, no mínimo, adicionar feedback visual quando um par é quebrado.
- **`QuickActions`**: padronizar comportamento — todas devem abrir modal in-page (preferencial) ou todas devem navegar para `/x/novo`. Hoje é 4 de um jeito, 2 de outro.
- **Substituir ícone `User`** em "Pedidos a faturar" do AlertStrip por `ClipboardList` (consistente com o card operacional).
- **`PendenciasList`**: quando o range custom é maior que a janela `[-60d, +7d]`, mostrar mensagem "Mostrando próximos 7d e atrasados dos últimos 60d (limite do widget)" em vez de lista vazia silenciosa.
- **Remover emoji 👋** ou padronizar uso de emojis em todo o app.

---

## 6. Melhorias estruturais

- **Unificar containers visuais**: refatorar `FinanceiroBlock`, `ComercialBlock`, `EstoqueBlock`, `LogisticaBlock`, `FiscalBlock`, `QuickActions` para usar `DashboardCard` (header + body slots), eliminando ~6 cópias de `bg-card rounded-xl border`.
- **Tipar `metricDrawer`** com discriminated union ao invés de `null | "receber" | "pagar" | "saldo" | "estoque"` — abrir caminho para passar payload com `scope` e título dinâmico, removendo o switch implícito do JSX (L385-465).
- **Extrair o drawer de KPI** para `src/components/dashboard/KpiDetailDrawer.tsx` — `Index.tsx` tem 483 linhas, das quais ~120 são JSX do drawer.
- **Centralizar a lista de status "abertos" de orçamentos/OVs** em uma constante exportada (hoje `OPEN_ORC_STATUSES` vive só dentro do hook do dashboard; o módulo Orçamentos usa sua própria lista). Mesma sugestão para `BACKLOG_OV_STATUSES`.
- **Adicionar testes unitários** para `buildDrilldownUrl` e para `useDashboardKpis` (formatação, edge cases de zero, sinal do saldo).
- **Eliminar `DashboardLayoutItem` e `DEFAULT_LAYOUT`** de `useDashboardLayout.ts`; renomear para `useDashboardWidgetPrefs` (mais fiel ao escopo real: visibility + order).
- **Substituir `today = new Date().toISOString().slice(0,10)`** por `formatLocalDate(new Date())` em `useDashboardAuxData` e qualquer outro hook que use cutoff de dia.
- **Documentar o contrato dos drill-downs** no topo de `drilldown.ts` listando, para cada intent, qual hook produz a contagem e qual filtro a página de destino aplica — facilita auditoria de divergências futuras.
- **Considerar `Suspense` boundary único** ao redor das linhas do dashboard, em vez de `LazyInViewWidget` por widget — reduz boilerplate.
- **Avaliar realtime parcial** (canal Supabase já usado em `useSidebarAlerts`) para invalidar a queryKey do dashboard em mutações críticas (NF emitida, OV faturada, baixa financeira), eliminando dependência do botão "Atualizar".

