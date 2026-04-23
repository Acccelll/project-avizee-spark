
Implementar R3 (PeriodFilter global no header) e R4 (ItemsGrid consolidado) — os dois itens estruturais restantes do roadmap mobile.

## Entrega 1 — R3: PeriodFilter global

**Estado atual:**
- `DashboardPeriodContext` já existe e é consumido pelo Dashboard (Index).
- Outras páginas (Financeiro, Comercial, Compras, Fiscal, Auditoria, Social) usam `PeriodFilter` localmente, cada uma com seu próprio state.
- O contrato `mem://produto/contrato-de-periodos.md` já define presets canônicos.

**Mudança:**
1. Renomear `DashboardPeriodContext` → `GlobalPeriodContext` (manter export alias para não quebrar Index).
2. Provider já está montado no `App.tsx` (verificar). Se não, montar.
3. Adicionar um seletor compacto de período no `MobileDashboardHeader` (já existe) — confirmar que está OK.
4. Adicionar slot opcional `<GlobalPeriodChip>` no `AppHeader` mobile que abre um popover com PeriodFilter, alterando o contexto global.
5. Páginas continuam com seu PeriodFilter local (não migrar todas — risco alto). O global serve como **default** para novas telas e para o dashboard.

Decisão: fazer R3 de forma **incremental e não-invasiva** — apenas expor o chip global no AppHeader mobile. Não migrar páginas existentes (escopo controlado).

## Entrega 2 — R4: ItemsGrid consolidado

**Estado atual:**
- `OrcamentoForm`, `PedidoForm`, `RemessaForm`, NF-forms têm grids próprios de itens (produto + qtd + valor).
- Cada um repete: cabeçalhos de coluna, linha por item, botão remover, total, scroll mobile.

**Mudança:**
1. Criar `src/components/forms/ItemsGrid.tsx` — wrapper genérico com:
   - `columns: { key, label, render, width?, align?, mobileLabel? }[]`
   - `items: T[]`
   - `onRemove?: (index) => void`
   - `onAdd?: () => void`
   - `emptyMessage?: string`
   - `footerSummary?: ReactNode` (totais)
   - Renderiza tabela em desktop, cards empilhados em mobile.
2. **NÃO migrar** os forms existentes nesta entrega — apenas disponibilizar o componente. Migração é arriscada e cada form tem regras específicas (pricing, descontos, vinculação a estoque). Documentar no JSDoc + memória como "padrão preferido para novos forms".

## Arquivos
- `src/contexts/DashboardPeriodContext.tsx` → adicionar export alias `GlobalPeriodContext` / `useGlobalPeriod`.
- `src/components/navigation/GlobalPeriodChip.tsx` → NOVO (chip mobile que abre popover).
- `src/components/AppHeader.tsx` ou equivalente → integrar chip mobile (read-only se não houver header mobile genérico).
- `src/components/forms/ItemsGrid.tsx` → NOVO componente reutilizável.
- `mem://produto/mobile-overview.md` → marcar R3/R4 como "infraestrutura disponível, migração on-demand".

## Sem mudança
- Forms existentes (Orçamento/Pedido/Remessa/NF) — não migrar agora.
- Páginas com PeriodFilter local — não migrar agora.
- Schema, RLS, edge functions.
