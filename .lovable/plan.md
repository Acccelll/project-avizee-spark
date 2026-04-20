

## Revisão estrutural — Dashboard principal

### Diagnóstico real

1. **Período global mente parcialmente.** O `DashboardPeriodContext.range` só é honrado por `useDashboardFinanceiroData` (sobre `data_vencimento`), `useDashboardComercialData` (sobre `data_orcamento`/`data_pedido`) e nada mais. Faturamento (mês atual fixo), `topClientes`/`topProdutos`/`dailyVendas`/`dailyReceber`/`dailyPagar` (janelas fixas de 7 dias), `fiscalStats` (mês fiscal fixo), `aux.clientes/fornecedores/remessas/comprasAtrasadas` e `PendenciasList` (-60d/+7d hardcoded) ignoram o período. A UI promete uniformidade que não existe.
2. **Drill-down praticamente nulo.** `AlertStrip` e os blocos navegam para `/financeiro`, `/estoque`, `/logistica`, `/pedidos`, `/fiscal` **sem query string**. Apenas `Fiscal.tsx` consome `?tipo=` (e `?pedido_compra_id=` em outro fluxo) e `Pedidos.tsx`/`Conciliacao.tsx` consomem seus próprios params. KPIs já passam `?tipo=receber|pagar` para `/financeiro`, mas `Financeiro.tsx` não lê esse param. Resultado: o usuário sai da dashboard e cai numa lista crua, perdendo o contexto.
3. **KPIs principais semanticamente heterogêneos.** A linha mistura três KPIs de **valor (R$)** com sparkline e meta + um KPI de **exceção em unidades** (Estoque Crítico) sem meta nem sparkline. Quebra a leitura executiva.
4. **Legacy paralelo já isolado mas vivo.** `DashboardFiscal.tsx`, `AlertCards.tsx`, `RecentCompras.tsx`, `RecentOrcamentos.tsx`, `ComprasConfirmadasDetail.tsx`, `BacklogDetail.tsx`, `EstoqueBaixoDetail.tsx`, `VencimentosProximosCard.tsx`, `SummaryPie.tsx` estão marcados `@legacy` e não são renderizados em lugar nenhum, mas continuam no bundle.
5. **`useDashboardLayout` órfão.** O hook existe com `DEFAULT_LAYOUT` e persistência por usuário, mas não é importado em nenhum lugar — Index.tsx é layout fixo.
6. **Ticket médio mistura janelas.** `ComercialBlock` recebe `cotacoesAbertas` (filtrado por período) + `pedidosPendentes` (sem período) + `ticketMedio` (mês atual fixo). Três escalas temporais no mesmo card.
7. **Notas pendentes** no `AlertStrip` agrega rascunhos fiscais (`status='rascunho'`) — isso é exceção operacional ou apenas estado natural? Hoje é tratado como alerta `info`, mas pode poluir a faixa.

---

### Decisões estruturais

#### 1. Contrato `DashboardPeriodScope` por bloco
Adicionar metadados explícitos sobre **qual eixo temporal cada bloco usa**, exposto pela própria Dashboard.

```ts
type PeriodScope =
  | { kind: 'global-range'; eixo: 'data_vencimento' | 'data_orcamento' | 'data_pedido' | 'data_emissao' }
  | { kind: 'fixed-window'; janela: 'today' | 'next-7d' | 'last-7d' | 'mes-atual' | 'mes-anterior' }
  | { kind: 'snapshot' };  // contagens "agora" (clientes ativos, estoque atual)
```

Cada hook anexa `_scope` ao retorno; cada componente de bloco mostra um `<ScopeBadge>` discreto no header (ex.: "Mês atual" no card de Faturamento, "Próximos 7 dias" no fluxo, "Snapshot" em Estoque).

#### 2. Drill-down contextual real
Padronizar um helper `buildDrilldownUrl(modulo, params)` em `src/lib/dashboard/drilldown.ts` que gera URLs com filtros consumíveis. Os módulos-alvo precisam consumir os params:

| Origem (Dashboard) | Destino | Params propostos | Ação no destino |
|---|---|---|---|
| KPI Receber | `/financeiro?tipo=receber&status=aberto,parcial,vencido` | `tipo`, `status`, `de`, `ate` | Aplicar nos filtros do `Financeiro.tsx` |
| KPI Pagar | `/financeiro?tipo=pagar&status=aberto,parcial,vencido` | idem | idem |
| KPI Saldo | `/fluxo-caixa` | — | já navega |
| KPI Estoque Crítico | `/estoque?critico=1` | `critico` | Filtrar `estoque_atual <= estoque_minimo` |
| Alerta Vencidos | `/financeiro?status=vencido` | `status` | filtro |
| Alerta Estoque mín. | `/estoque?critico=1` | `critico` | filtro |
| Alerta Remessas atrasadas | `/logistica?tab=remessas&atrasadas=1` | `tab`, `atrasadas` | tab + filtro |
| Alerta Compras atraso | `/pedidos-compra?atrasadas=1` | `atrasadas` | filtro |
| Alerta Notas pendentes | `/fiscal?status=rascunho` | `status` | filtro |
| Alerta OVs a faturar | `/pedidos?faturamento=aguardando,parcial` | `faturamento` (já existe) | já existe |
| Item de PendenciasList | `/financeiro/{id}` | path | já existe |

**Esta sprint implementa**: o helper, atualização da `AlertStrip`/KPIs/blocos para usar URLs contextuais, e consumo dos params em `Financeiro.tsx`, `Estoque.tsx`, `Logistica.tsx`, `PedidosCompra.tsx`, `Fiscal.tsx`. Pedidos.tsx já está coberto.

#### 3. KPIs principais coerentes
- **3 KPIs de valor** na linha primária: Contas a Receber, Contas a Pagar, Saldo Projetado (mantêm sparkline + meta).
- **Estoque Crítico** sai dessa linha e passa para uma faixa secundária de "Indicadores operacionais" junto a `backlogOVsCount`, `comprasAtrasadasCount`, `remessasAtrasadas` — usando `SummaryCard density="compact"` sem sparkline e sem meta, com semântica de **exceção** (não volume).
- Layout: `grid-cols-3` para KPIs financeiros + bloco horizontal "Indicadores operacionais" abaixo.

#### 4. Período global por bloco — quem usa o quê
Documentar e expor:
- **Financeiro** (totais R$, contas em aberto): `global-range` em `data_vencimento`. ✅ já está.
- **Comercial cotações abertas**: `global-range` em `data_orcamento`. ✅ já está.
- **Faturamento (ticket médio, mesAtual/mesAnterior)**: `fixed-window` mês atual/anterior. **Não muda.** Documentar com badge.
- **`dailyReceber`/`dailyPagar`**: `fixed-window` próximos 7 dias. **Não muda.** Badge "Próximos 7 dias".
- **`dailyVendas`**: `fixed-window` últimos 7 dias. Badge "Últimos 7 dias".
- **`topClientes`/`topProdutos`**: hoje sem range no financeiro e mês-atual no comercial. **Mudança**: passar a respeitar `range` global quando informado, fallback mês atual. (eixo: `data_emissao` para produtos, `data_vencimento` para clientes-receber).
- **`fiscalStats`**: passar a respeitar `range` global. Fallback mês atual.
- **`vencimentosHoje`**: snapshot "hoje". Nunca muda. Badge "Hoje".
- **`PendenciasList`**: passa a respeitar período (com mínimo: se range > 7d futuros, ainda usa `+7d` como teto para evitar inundar a lista).
- **`aux.clientes/fornecedores`**: snapshot.
- **`aux.remessasAtrasadas`/`comprasAtrasadasCount`**: snapshot "agora", semântica de exceção.

#### 5. Personalização de layout — ativar de forma controlada
- Manter `useDashboardLayout` mas trocar persistência de `localStorage` para `user_preferences` (chave `dashboard_layout_v1`), com fallback localStorage durante migração. Reaproveita o padrão `useUserPreference` já existente.
- **Não** introduzir `react-grid-layout` agora. Em vez disso: usar a lista de widgets do hook para permitir **ocultar/reordenar** blocos via popover "Personalizar dashboard" no `DashboardHeader` (toggle de visibilidade + drag-handle simples com `dnd-kit` se já presente, senão apenas "subir/descer"). Drag completo fica para evolução futura.
- Lista oficial de widgets fica em `src/lib/dashboard/widgets.ts`, exportando `WIDGET_REGISTRY: Record<WidgetId, { label; render: () => ReactNode; defaultVisible: boolean }>`. Index.tsx itera essa lista.
- Layout permanece em CSS Grid responsivo (não rompe nada). Personalização inicial = visibilidade + ordem.

#### 6. Alertas operacionais — prioridade e criticidade
Reorganizar `AlertStrip` para ordenar por severidade (`error → warning → info`) e adicionar prioridade visual nos primeiros 2 com ícone maior. Mover "Notas pendentes" (rascunho) de `info` para `warning` apenas se `> 5`. Cada alerta passa a usar `buildDrilldownUrl`.

#### 7. Harmonização dos blocos
Alinhar todos os blocos a um contrato visual mínimo: header com título + `<ScopeBadge>` + botão "Ver módulo" (drill-down contextual, não genérico). Adicionar empty-state padronizado quando o bloco está sem dados no período. Sem refatorar internals.

#### 8. Limpeza de legado
Remover do bundle os componentes marcados `@legacy` e não-renderizados:
- `src/components/dashboard/DashboardFiscal.tsx`
- `src/components/dashboard/AlertCards.tsx`
- `src/components/dashboard/RecentCompras.tsx`
- `src/components/dashboard/RecentOrcamentos.tsx`
- `src/components/dashboard/ComprasConfirmadasDetail.tsx`
- `src/components/dashboard/BacklogDetail.tsx`
- `src/components/dashboard/EstoqueBaixoDetail.tsx`
- `src/components/dashboard/VencimentosProximosCard.tsx`
- `src/components/dashboard/SummaryPie.tsx`

Antes de deletar cada um, confirmar via `code--search_files` que não há import vivo (todos foram marcados como não-renderizados; última confirmação no momento da edição).

---

### Plano de execução

#### Novos arquivos
1. `src/lib/dashboard/drilldown.ts` — helper `buildDrilldownUrl` + tipos.
2. `src/lib/dashboard/widgets.ts` — registry oficial de widgets.
3. `src/components/dashboard/ScopeBadge.tsx` — badge discreto "Mês atual"/"Próximos 7 dias"/"Hoje"/"Snapshot".
4. `src/components/dashboard/DashboardCustomizeMenu.tsx` — popover de personalização (visibilidade + reordenação).

#### Hooks modificados
5. `src/pages/dashboard/hooks/types.ts` — adicionar `_scope` ao retorno de cada hook + tipo `PeriodScope`.
6. `useDashboardComercialData.ts` — `topProdutos` passa a usar `range` quando informado.
7. `useDashboardFinanceiroData.ts` — `topClientes` passa a usar `range` quando informado.
8. `useDashboardFiscalData.ts` — aceita `range` e filtra `data_emissao`.
9. `useDashboardKpis.ts` — separar `kpiCards` (3 financeiros) de `operationalCards` (estoque crítico + 3 contagens de exceção).
10. `useDashboardLayout.ts` — persistir em `user_preferences` (com fallback localStorage), expor `visibility` e `order`.
11. `useDashboardData.ts` — orquestra novos retornos e expõe `scopes`.

#### Componentes modificados
12. `src/pages/Index.tsx` — itera `widgets.ts`, separa linhas de KPI, usa `DashboardCustomizeMenu`, integra `useDashboardLayout`.
13. `src/components/dashboard/AlertStrip.tsx` — usa `buildDrilldownUrl`, ordena por severidade.
14. `src/components/dashboard/FinanceiroBlock.tsx` / `ComercialBlock.tsx` / `EstoqueBlock.tsx` / `LogisticaBlock.tsx` / `FiscalBlock.tsx` — header com `<ScopeBadge>`, drill-down contextual no botão "Ver módulo".
15. `src/components/dashboard/DashboardHeader.tsx` — botão "Personalizar".
16. `src/components/dashboard/PendenciasList.tsx` — respeita `range` global (com teto de +7d).

#### Páginas-destino (consumir params do drill-down)
17. `src/pages/Financeiro.tsx` — ler `tipo`, `status`, `de`, `ate` da URL e aplicar nos filtros.
18. `src/pages/Estoque.tsx` — ler `critico=1` e aplicar filtro pré-existente de "abaixo do mínimo".
19. `src/pages/Logistica.tsx` — ler `tab` e `atrasadas=1`.
20. `src/pages/PedidosCompra.tsx` — ler `atrasadas=1`.
21. `src/pages/Fiscal.tsx` — ampliar leitura existente para aceitar `status=rascunho`.

#### Limpeza
22. Deletar 9 arquivos `@legacy` listados na seção 8.

---

### Detalhes técnicos

**Compatibilidade**
- Nenhum schema SQL muda. Tudo é refatoração de cliente.
- `useDashboardLayout` migra storage; ler `localStorage` na primeira carga, gravar em `user_preferences` na primeira escrita.
- Index.tsx mantém layout responsivo (grid CSS) — personalização inicial é visibilidade+ordem, não drag absoluto.
- Cada novo param de URL é **opcional** nos destinos: ausência = comportamento atual.

**Pontos para evolução futura**
- Drag absoluto via `react-grid-layout` (decisão adiada).
- KPI de "Margem bruta" e "DSO/DPO" (precisa de dados não calculados hoje).
- Realtime via `supabase.channel` para refletir mudanças em alertas sem refresh.
- `PendenciasList` poderia respeitar 100% o range global quando o usuário pede explicitamente "tudo".

**Fora de escopo**
- Permissões granulares por widget (admin vê tudo, vendedor vê comercial). Vai requerer integração com `user_permissions` — fica para sprint própria.
- Relatórios parametrizados na rota `/relatorios?tipo=...` (parcialmente já existe via `VendasChart`).
- Reescrita de `Financeiro.tsx`/`Estoque.tsx` para usar `useSearchParams` como source-of-truth dos filtros (apenas leitura inicial nesta sprint).

