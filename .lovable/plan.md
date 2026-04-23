

# Auditoria final — pendências mobile

Conferência completa do roadmap mobile vs código atual.

## ✅ Tier A — concluído (100%)

| Item | Status |
|---|---|
| DataTables com `mobileStatusKey/mobileIdentifierKey` | ✅ 11 cadastros + Auditoria + Social |
| Sticky save em forms longos | ✅ Orçamento, Pedido, Remessa |
| Filtros bottom-sheet | ✅ AdvancedFilterBar (Estoque, Logística, Compras) |
| RelationalDrawerStack mobile (limite 3 + breadcrumb) | ✅ |
| Dialog responsivo por default | ✅ Bottom-sheet mobile + safe-area |
| ScrollableTabsList | ✅ Estoque, Logística, Social |
| Auditoria mobile | ✅ Filtros grid + DataTable card |
| Social mobile | ✅ Filtros grid + DataTables card |
| MobileMenu lista todas seções | ✅ |
| Migração mobile (blocking screen) | ✅ Decisão de produto |

## ✅ Tier C — parcial

| Item | Status |
|---|---|
| Bottom nav contextual por módulo | ✅ CONTEXTUAL_TABS_BY_SECTION |

## ⚠️ Pendências reais remanescentes

| # | Item | Severidade | Justificativa |
|---|---|---|---|
| **R1** | `<ResponsiveDialog>` wrapper único com API uniforme (`primaryAction/secondaryAction`) | **Baixa** | Dialog já é responsivo; ganho marginal. Só compensa se houver decisão de migrar `AlertDialog` em massa. |
| **R2** | Lint/check automático de touch targets <44px | **Baixa** | Ferramenta de DX, não UX visível. Trabalho pontual e isolado. |
| **R3** | `PeriodFilter` global no header mobile | **Média** | Tier C2. Centralizaria o seletor de período no AppHeader mobile em vez de cada página. Estrutural. |
| **R4** | Consolidar `<ItemsGrid>` único para grids de itens | **Média** | Tier C3. Hoje cada form (Orçamento/Pedido/Remessa/NF) tem sua própria grid de itens. Estrutural. |
| **R5** | Sweep tipográfico residual (`text-[10px]/[11px]` em conteúdo) | **Baixa** | Polimento. |
| **R6** | Toasts e strings longas truncadas em mobile | **Baixa** | Polimento. |

## Recomendação

**O Tier A (operacional crítico) está 100% fechado.** Restam apenas itens de polimento (R1, R2, R5, R6) e dois estruturais grandes (R3, R4) que merecem sprint dedicado.

**Próxima entrega sugerida — pacote de polimento (R2 + R5 + R6):**
- Script de lint que escaneia componentes em busca de `h-{<11}` em elementos clicáveis e reporta violações.
- Sweep regex de `text-[10px]` e `text-[11px]` em `src/pages/**` e `src/components/**` (excluindo badges/labels intencionais), trocando por `text-xs` quando aplicável.
- Sweep de `toast.success/error` com strings longas para garantir `description` em vez de `title` extenso.

**Alternativa estrutural — R3 (PeriodFilter global):**
- Mover `PeriodFilter` para `MobileDashboardHeader` + `AppHeader` mobile.
- Criar `GlobalPeriodContext` consumido por todos os módulos com filtro temporal (Financeiro, Comercial, Compras, Fiscal, Auditoria, Social).
- Manter override local em páginas que precisam de range diferente do global.

## Sem mudança
- Tier A já entregue, schema de banco, navegação desktop, comportamento desktop.

