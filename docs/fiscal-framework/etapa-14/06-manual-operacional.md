# 06 — Manual Operacional

## Monitoramento
- **Central Fiscal** (`operacional/dashboardService`): indicadores de emissão, rejeições, pendências.
- **Monitor SEFAZ** (`operacional/sefazMonitorService`): usa o circuit breaker (Etapa 5); alertas quando aberto.
- **Cron health**: tabela `cron_health` + RPC `touch_cron_health`; card no admin.
- **Observabilidade regulatória** (`compliance/observabilidadeRegulatoria`): versões, tributos vigentes, pendências, alertas.

## Resolução de problemas
| Sintoma | Investigação | Ação |
|---------|--------------|------|
| Rejeição SEFAZ (cStat ≠ 100) | `fiscal_auditoria` + `nota_fiscal_eventos` | Corrigir dados; retransmitir |
| Circuit breaker aberto | `fiscal_circuit_state` | Aguardar half-open; verificar endpoint |
| Certificado próximo do vencimento | evento `fiscal.certificado.expira_em_breve` | Substituir PFX em `dbavizee/certificados/` |
| XML duplicado no recebimento | evento `fiscal.recebimento.xml.duplicado` | Investigar origem; nenhuma ação se intencional |
| Divergência de apuração | `escrituracao/consistencias` | Ajustar parâmetros vigentes (versionar) |

## Manutenção preventiva
- Renovar certificados A1 antes de 30 dias da expiração.
- Revisar endpoints (`fiscal_endpoints`) a cada Nota Técnica publicada.
- Rodar suíte de compatibilidade (`compliance/testesCompatibilidade`) após NT.

## Contingência
- Contingência manual documentada em ADR-013. Reprocessamento via fila com `Idempotency-Key`.

## Procedimentos de emergência
- Rotação de credenciais: RPCs `SECURITY DEFINER` no Vault (nunca expor).
- Bloqueio total: alternar flag `fiscal:v2:*` (strangler — ADR-016) para voltar ao serviço legado.
