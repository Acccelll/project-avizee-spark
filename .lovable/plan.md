

# Auditoria de pendências — revisões mobile

Conferência item-a-item entre o roadmap (`.lovable/plan.md` + `mem://produto/mobile-overview.md`) e o código atual.

---

## Status real por item

### ✅ Concluídos (entregues nas últimas sessões)

| # | Item | Evidência |
|---|---|---|
| 1 | Auditoria de DataTables sem props mobile | 11 cadastros com `mobileStatusKey/mobileIdentifierKey` + warn em dev no `DataTable.tsx` |
| 2 | `mobileStatusKey` em cadastros simples | Clientes, Produtos, Fornecedores, Transportadoras, Funcionários, Sócios, FormasPagamento, GruposEconomicos, ContasBancarias, ContasContabeis, UnidadesMedida |
| 4 | Dashboard mobile (Index.tsx) | Já usa `MobileDashboardHeader` + `MobileCollapsibleBlock` |
| 6/A1 | Sticky footer "salvar dirty" em cadastros | `FormModal` + `FormModalFooter` + `DialogFooter` sticky bottom-sheet em mobile |
| 7/A2 | Filtros bottom-sheet em Estoque/Logística/Compras | `AdvancedFilterBar` usa Drawer vaul nativo |
| 8/A3 | RelationalDrawerStack: limite 3 + breadcrumb mobile | `MAX_DRAWER_DEPTH_MOBILE=3` + `DrawerStackBreadcrumb` sticky |
| 12 | Migração mobile | `MigracaoDados.tsx` mostra blocking screen "Use no desktop" — decisão correta de produto |
| menu | MobileMenu lista todas as seções | Filtro `BOTTOM_TAB_KEYS` removido |
| dialog | `<Dialog>` responsivo por default | Bottom-sheet mobile + safe-area no `dialog.tsx` |

### ⚠️ Pendências reais detectadas

| # | Item | Evidência da pendência |
|---|---|---|
| **P1** | **Edição de itens dinâmicos sem sticky save** | `RemessaForm.tsx:341` usa `flex justify-end gap-3 pb-6` (botões soltos no fim, sem sticky). `PedidoForm.tsx:297` idem. `OrcamentoForm.tsx` já tem (1413). |
| **P2** | **Tabs horizontais sem overflow indicator** | `Logistica.tsx:605`, `Estoque.tsx:472`, `Social.tsx:247` usam `<TabsList>` cru. Componente `<ScrollableTabs>` ainda **não existe**. |
| **P3** | **Revisão dedicada de Auditoria mobile** | `Auditoria.tsx` tem `PeriodFilter` ✅, mas filtros (`Select w-[170px]`, `w-[200px]`) são fixos — quebram em <400px; KPIs vão em grid 6, tabela ultra-densa. Falta `mobileStatusKey/mobileIdentifierKey` no `DataTable`. |
| **P4** | **Revisão dedicada de Social mobile** | `Social.tsx:247` tem 6 tabs sem overflow indicator + nenhum check de `useIsMobile()`. Cards/tabelas internas (`SocialContasTab`, `SocialPostsTab` etc.) não foram auditados. |
| **P5** | **Lint/check automático de touch targets <44px** | Não implementado (item 10/19 do roadmap). |
| **P6** | **`<ResponsiveDialog>` wrapper único** | Dialog responsivo está embutido em `dialog.tsx`, mas não há um wrapper com API uniforme (`primaryAction/secondaryAction`). Migração incompleta de `AlertDialog` (ex: `MigracaoDados.tsx:913`). |
| **P7** | **Bottom nav contextual por módulo** | Tier C1 — nenhuma alteração no `MobileBottomNav.tsx`. |
| **P8** | **`PeriodFilter` global no header mobile** | Tier C2 — não implementado. |
| **P9** | **Consolidar `<ItemsGrid>` único** | Tier C3 — não implementado. |

---

## Recomendação de próxima entrega (Tier A residual)

Foco em **fechar o Tier A** antes de avançar para Tier C (estruturais grandes). Três entregáveis pequenos e independentes:

### Entrega 1 — Sticky save em Pedido/Remessa (P1)
- `src/pages/PedidoForm.tsx`: substituir bloco `flex gap-3` (linha 297) por footer sticky mobile idêntico ao do `OrcamentoForm.tsx` (visível só quando `isDirty`).
- `src/pages/RemessaForm.tsx`: idem (linha 341), agregando o `isDirty` já existente.
- Padrão de classe: `md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t z-40 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]` + spacer `h-24 md:hidden`.

### Entrega 2 — `<ScrollableTabs>` global (P2)
- Criar `src/components/ui/scrollable-tabs.tsx`: wrapper sobre `<TabsList>` com `overflow-x-auto scrollbar-none` + gradiente de fade nas bordas (sombras internas) detectado via scroll position.
- Migrar 3 telas de maior impacto: `Estoque.tsx`, `Logistica.tsx`, `Social.tsx`.
- Não tocar em `Configuracoes.tsx` (já tem padrão próprio).

### Entrega 3 — Revisão mobile de Auditoria (P3)
- `src/pages/Auditoria.tsx`:
  - Adicionar `mobileStatusKey="criticidade"` + `mobileIdentifierKey="entidade"` + `mobilePrimaryAction` (abrir detalhe) no `<DataTable>`.
  - Filtros (`Select w-[170px]/[200px]`) → `w-full` em mobile, agrupados em `<AdvancedFilterBar>` com presentation drawer.
  - Reduzir `summaryCards` para 2 prioritários em mobile (Eventos no Período + Eventos Sensíveis), demais via accordion.

### Fora desta entrega (próximos sprints)
- **P4 (Social mobile)**: revisão dedicada — escopo grande, melhor isolar.
- **P5 (lint touch target)**: ferramenta, não UX — separar.
- **P6 (`<ResponsiveDialog>` wrapper)**: ganho marginal já que `dialog.tsx` resolve ~95% — só faz sentido se decidir migrar `AlertDialog` em massa.
- **P7-P9 (Tier C)**: estrutural, sprint dedicado.

---

## Arquivos a tocar (Entregas 1-3)

| Arquivo | Mudança |
|---|---|
| `src/pages/PedidoForm.tsx` | Sticky save mobile (footer condicional `isDirty`) + spacer |
| `src/pages/RemessaForm.tsx` | Sticky save mobile + spacer |
| `src/components/ui/scrollable-tabs.tsx` | **NOVO** — wrapper com fade-edges |
| `src/pages/Estoque.tsx` | Trocar `<TabsList>` por `<ScrollableTabsList>` |
| `src/pages/Logistica.tsx` | idem |
| `src/pages/Social.tsx` | idem |
| `src/pages/Auditoria.tsx` | DataTable mobile props + filtros responsivos + summaryCards prioritários em mobile |
| `mem://produto/mobile-overview.md` | Marcar P1/P2/P3 como resolvidos; manter P4-P9 no backlog |

## Sem mudança
- Schema de banco, RLS, edge functions, navegação global, sidebar desktop, comportamento desktop em geral.

