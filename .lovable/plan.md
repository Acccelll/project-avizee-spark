

## Plano — Auditoria estrutural (P17–P23)

Risco priorizado: P20 (segurança), P18+P19 (perf realtime), P22 (a11y), P21 (DX), P17 (refactor enorme), P23 (limpeza).

### Bloco 1 — Segurança (P20)
**`useImportacaoXml.ts`:** validar antes de processar:
- `MAX_FILE_SIZE_MB = 50` por arquivo.
- `MAX_XML_FILES = 200` por ZIP.
- `MAX_ZIP_EXPANDED_MB = 200` (somar `_data.uncompressedSize` durante iteração; abortar ao estourar).
- Se `selectedFiles.length > 10`, sugerir uso de ZIP.
- Toasts de erro claros e early return.

### Bloco 2 — Performance & Realtime (P18, P19)
**P18 — query estoque baixo:** Supabase PostgREST não suporta comparação coluna×coluna direto. Solução: criar **migration** com RPC `count_estoque_baixo()` (`SECURITY DEFINER`, `search_path = public`) que retorna `bigint`. Substituir o filtro client-side por `supabase.rpc('count_estoque_baixo')`. Payload vira 1 inteiro.

**P19 — unificar alertas:**
- Migrar `useSidebarAlerts` para `useQuery` (`queryKey: ['sidebar-alerts']`, `staleTime: 60_000`).
- Criar singleton `src/lib/realtime/alertsChannel.ts` com `getAlertsChannel(onUpdate)` para evitar canais duplicados em re-renders/StrictMode.
- `NotificationsPanel.tsx`: remover queries próprias e canal duplicado; consumir `useSidebarAlerts` + dados já carregados. Manter o cálculo de itens críticos de estoque via uma segunda query enxuta no mesmo hook (lista enxuta com `limit(20)` apenas quando o painel abrir — via hook secundário `useNotificationDetails(open)`).

### Bloco 3 — Acessibilidade (P22)
Adicionar `aria-label` em botões só-ícone nos 4 componentes prioritários:
- `DataTable.tsx` (editar/excluir/visualizar por linha — usar nome da entidade no label).
- `OrcamentoItemsGrid.tsx` (remover item).
- `FormModalFooter.tsx` (fechar/cancelar).
- `ViewDrawerV2.tsx` (fechar drawer).
Escopo limitado — não vou varrer 306 botões nesta passada.

### Bloco 4 — Dashboard com React Query (P21)
- Refatorar `useDashboardData.ts` para `useQuery({ queryKey: ['dashboard', range], queryFn, staleTime: 2*60_000, gcTime: 5*60_000, retry: 1 })`.
- Manter shape de retorno retrocompatível: expor `data`, `isLoading`, `refetch`, `dataUpdatedAt` mas também os campos achatados (`stats`, `faturamento`, etc.) com defaults de `INITIAL_STATE` quando `data` indefinido — para não quebrar `Index.tsx` e widgets.
- `Index.tsx`: trocar `loadData()` no `useEffect` por nada (React Query cuida); botão "Atualizar" chama `refetch()`; `loadedAt` vira `new Date(dataUpdatedAt)`.

### Bloco 5 — Limpeza (P23)
- Verificar usos de `ViewDrawer` (v1). Se só `Auditoria.tsx`, migrar para `ViewDrawerV2` e deletar `ViewDrawer.tsx`. Se tiver outros usos, marcar como `@deprecated`.

### Fora de escopo
- **P17 (mover 20 páginas para camada de serviços):** refactor gigantesco e arriscado. Vou criar `src/services/clientes.service.ts` com as queries de endereços/comunicações/transportadoras (extraídas dos novos sub-componentes do refactor anterior) como **prova de padrão**, e documentar em `docs/services-migration-plan.md` o roteiro para Fiscal/Orçamento/FluxoCaixa em passadas futuras. Mover Fiscal.tsx e OrcamentoForm.tsx (14 chamadas cada) num único lote junto com tudo isso seria irresponsável.
- Auditoria completa de `aria-label` em todos os 306 botões.
- View materializada para estoque baixo (RPC simples já resolve sem o custo de manutenção de MV).

### Critério de aceite
- Imports XML rejeitam arquivos >50MB, ZIPs com >200 XMLs ou expansão >200MB.
- Sidebar alerts via React Query + RPC `count_estoque_baixo` (1 inteiro de payload).
- Apenas 1 canal realtime de alertas no app (singleton).
- 4 componentes prioritários com `aria-label` em botões só-ícone.
- Dashboard com cache entre navegações; botão "Atualizar" usa `refetch()`.
- `ViewDrawer` v1 deletado ou marcado deprecated.
- `clientes.service.ts` criado como template + plano de migração documentado.
- Build OK.

### Migrations
1. `CREATE FUNCTION public.count_estoque_baixo() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT count(*) FROM produtos WHERE ativo = true AND estoque_minimo > 0 AND estoque_atual <= estoque_minimo; $$;` + GRANT EXECUTE para `authenticated`.

### Arquivos afetados
**Segurança:** `src/hooks/importacao/useImportacaoXml.ts`.
**Perf:** `src/hooks/useSidebarAlerts.ts`, `src/components/navigation/NotificationsPanel.tsx`, `src/lib/realtime/alertsChannel.ts` (novo), migration nova.
**A11y:** `src/components/DataTable.tsx`, `src/components/OrcamentoItemsGrid.tsx`, `src/components/FormModalFooter.tsx`, `src/components/ViewDrawerV2.tsx`.
**Dashboard:** `src/pages/dashboard/hooks/useDashboardData.ts`, `src/pages/Index.tsx`.
**Limpeza:** `src/pages/Auditoria.tsx`, `src/components/ViewDrawer.tsx` (delete ou deprecate).
**Serviços (template):** `src/services/clientes.service.ts` (novo), `docs/services-migration-plan.md` (novo), atualizar 3 sub-componentes de cliente para consumir o serviço.

