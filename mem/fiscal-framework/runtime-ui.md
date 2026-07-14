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

## Vitrine
`/fiscal/central` consome `fetchDashboardFiscal` + `runtime.operacional.dashboard` + `runtime.operacional.prontidao.gerar()`.
