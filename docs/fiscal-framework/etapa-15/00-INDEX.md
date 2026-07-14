# Etapa 15 — Integração UI/Runtime do Framework Fiscal

Integra o Framework Fiscal (Etapas 1–14) ao runtime do AVIZEE. Nenhuma regra fiscal nova.

## Entregas iniciais

| Item | Local |
|------|-------|
| Runtime Provider | `src/contexts/FiscalRuntimeContext.tsx` |
| Wiring no shell | `src/components/fiscal/FiscalShell.tsx` |
| Central Fiscal | `src/pages/fiscal/CentralFiscal.tsx` |
| Rota | `/fiscal/central` em `src/routes/fiscal.routes.tsx` |
| Navegação | `src/lib/navigation.ts` (parent + label) |
| Busca global | `src/components/navigation/GlobalSearch.tsx` |

## Backlog remanescente
Workspace multi-contexto, Data Grid corporativo, Notification Center, offline,
a11y, widgets em dashboards — todas as fatias devem reutilizar `useFiscalRuntime()`.
