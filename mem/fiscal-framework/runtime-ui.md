---
name: fiscal-framework/runtime-ui
description: Runtime UI do Framework Fiscal — FiscalRuntimeProvider, escopo /fiscal/*, Central Fiscal (Etapa 15)
type: feature
---

O Framework Fiscal é consumido pela UI via `FiscalRuntimeProvider`
(`src/contexts/FiscalRuntimeContext.tsx`), montado dentro de `FiscalShell`.

## Regras
- Nunca instanciar `bootstrapFiscal()` diretamente — usar `useFiscalRuntime()`.
- Não duplicar serviços operacionais; consumir `runtime.operacional.*`.
- Provider escopado a `/fiscal/*` (via `FiscalShell`) para evitar custo em perfis sem permissão.
- Design System exclusivamente (Card, Badge, SummaryCard, PeriodFilter).
- Rotas fiscais sempre com `PermissionRoute resource="faturamento_fiscal"`.
- Grids fiscais usam `FiscalDataGrid` (wrapper do DataTable) — não instanciar DataTable direto em `/fiscal/*`.
- Período/empresa de `/fiscal/*` vêm de `useFiscalWorkspace` (persistido em localStorage).
- Alertas contextuais derivam de `deriveFiscalAlerts(kpis)` e são exibidos via `FiscalNotificationCenter`.
- Shell provê a11y (skip link + `<main id="fiscal-main">`), breadcrumb e strip de recuperação de conexão.

## Vitrine
`/fiscal/central` consome `fetchDashboardFiscal` + `runtime.operacional.dashboard` + `runtime.operacional.prontidao.gerar()`.
