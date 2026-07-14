# Etapa 15 — Integração UI/Runtime do Framework Fiscal

Integra o Framework Fiscal (Etapas 1–14) ao runtime do AVIZEE. Nenhuma regra
fiscal nova — apenas composição, UX e observabilidade sobre serviços existentes.

## Entregas

| Item | Local |
|------|-------|
| Runtime Provider (singleton) | `src/contexts/FiscalRuntimeContext.tsx` |
| Shell (efeitos + a11y + offline + breadcrumb) | `src/components/fiscal/FiscalShell.tsx` |
| Central Fiscal (KPIs + monitor + prontidão) | `src/pages/fiscal/CentralFiscal.tsx` |
| Hook consolidado da Central | `src/hooks/useFiscalCentral.ts` |
| Derivação de alertas | `src/lib/fiscal/deriveAlerts.ts` |
| Notification Center (popover) | `src/components/fiscal/FiscalNotificationCenter.tsx` |
| Data Grid corporativo (wrapper) | `src/components/fiscal/FiscalDataGrid.tsx` |
| Workspace multi-contexto (empresa + período) | `src/hooks/useFiscalWorkspace.ts` |
| Conectividade / recuperação | `src/hooks/useFiscalConnectivity.ts` + `FiscalOfflineStrip.tsx` |
| Breadcrumb + skip link | `src/components/fiscal/FiscalBreadcrumb.tsx` |
| Rota `/fiscal/central` | `src/routes/fiscal.routes.tsx` |
| Navegação + busca global | `src/lib/navigation.ts`, `src/components/navigation/GlobalSearch.tsx` |

## Contratos-chave

- **Consumo do runtime:** toda tela fiscal usa `useFiscalRuntime()` — nunca
  instancia serviços operacionais/compliance diretamente.
- **Período:** `useFiscalWorkspace` é a fonte única de `period` + `empresaId`
  para `/fiscal/*` (persistido em `localStorage`), respeitando o contrato de
  períodos do produto.
- **Grid:** `FiscalDataGrid` aplica defaults (virtualização ≥50 linhas,
  `exportPermission="relatorios:exportar"`) sobre o `DataTable` do DS.
- **A11y:** shell provê skip link (`#fiscal-main`), `role="status"` no strip
  offline e `aria-current="page"` no breadcrumb.
