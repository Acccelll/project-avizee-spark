---
name: Framework Fiscal — Camada Operacional
description: Serviços de Central Fiscal, Monitor SEFAZ, Processamentos, Pendências, Notificações, Certificados, Busca Global, Observabilidade e Prontidão
type: feature
---

Módulo `src/modules/fiscal/operacional/` (Etapa 10). Apenas serviços — UIs reutilizam o `FiscalShell` e Design System existentes.

- `FiscalDashboardService`, `SefazMonitorService` (respeita circuit breaker), `ProcessamentoService`, `PendenciasService` (sugestão assistida, nunca resolve sozinho), `NotificacoesFiscaisService` (multicanal), `CertificadoService`, `BuscaGlobalFiscalService`, `ObservabilidadeService`, `ProntidaoProducaoService`.
- `PERMISSOES_FISCAIS`: catálogo granular para RBAC (fiscal_emissao/cancelar, fiscal_cce, fiscal_manifestacao, fiscal_certificados/gerenciar, fiscal_apuracao/{executar,fechar,reabrir}, ...).
- Persistência não incluída aqui: consumidores plugam adapters `IJobRepository`, `IPendenciasRepository`, `INotificacaoRepository`, `ICertificadoRepo` sobre Supabase.
- Restrição: não introduzir dependências externas; não alterar arquitetura das Etapas 1–9.
