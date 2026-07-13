# 50 · Matriz de rastreabilidade

Encadeamento: **Requisito → Caso de Uso → Serviço → Módulo → Entidade → API → Evento → Fluxo**.

Padrão de linha compacta (uma por funcionalidade):

| F | UC | Serviço | Módulo | Entidades | API | Eventos | Fluxo (doc 23) |
|---|----|---------|--------|-----------|-----|---------|----------------|
| F-001 Emissão NFe | UC-001, UC-002 | AutorizacaoService | fiscal-module-nfe | notas_fiscais, notas_fiscais_itens, nota_fiscal_anexos, fiscal_endpoints, fiscal_auditoria | API-001 autorizar, API-002 consultar-chave | DocumentoSerializado, DocumentoAssinado, DocumentoTransmitido, DocumentoAutorizado \| DocumentoRejeitado \| DocumentoDenegado | Fluxo 1 |
| F-002 Consulta situação | UC-003 | ConsultaService | fiscal-module-status | notas_fiscais (leitura) | API-002 | SefazRequisitado, SefazRespondeu | Fluxo 2 (síncrono) |
| F-003 Download XML | UC-004 | ExportacaoService | fiscal-module-nfe (parcial) | notas_fiscais, nfe_distribuicao | API-004 exportar-xml, API-012 | XMLExportado | Fluxo 8 |
| F-004 Import XML | UC-005 | ImportacaoService | fiscal-module-nfe (parse) | notas_fiscais, notas_fiscais_itens | API-005 importar-xml | XMLImportado, DocumentoRecebido | Fluxo 9 |
| F-005 Manifestação | UC-010, UC-031 | ManifestacaoService | fiscal-module-eventos | nota_fiscal_eventos | API-009 manifestar | ManifestacaoRegistrada, EventoRegistrado | Fluxo 7 |
| F-006 Cancelamento | UC-006 | EventoService | fiscal-module-eventos | nota_fiscal_eventos, notas_fiscais (status) | API-006 cancelar | CancelamentoAutorizado, DocumentoCancelado | Fluxo 3 |
| F-007 CCe | UC-007 | EventoService | fiscal-module-eventos | nota_fiscal_eventos | API-007 carta-correcao | CCeRegistrada, EventoRegistrado | Fluxo 4 |
| F-008 Inutilização | UC-008 | InutilizacaoService | fiscal-module-eventos | inutilizacoes_numeracao | API-008 inutilizar | InutilizacaoAutorizada, DocumentoInutilizado | Fluxo 5 |
| F-009 DFe | UC-009, UC-031 | DistribuicaoDFeService | fiscal-module-dfe | nfe_distribuicao, nfe_distribuicao_itens, nfe_distdfe_sync | API-010 sincronizar, API-011 listar, API-012 download | DFeSincronizado, DFeRecebido, DFeNSUAvancado | Fluxo 6 |
| F-010 Consulta cadastro | UC-011 | ConsultaService | fiscal-module-status (v1.1) | — | API-018 consulta-cadastro | SefazRequisitado, SefazRespondeu | Fluxo 2 (variante) |
| F-011 Status serviço | UC-012 | ConsultaService | fiscal-module-status | fiscal_status_sefaz_cache (opcional) | API-003 status-servico | SefazRequisitado, SefazRespondeu, CircuitBreaker* | Fluxo 15 (recuperação) |
| F-012 Cert A1 | UC-013, UC-014, UC-015 | CertificadoService | fiscal-certificate-manager | fiscal_certificado_metadata, bucket, Vault | API-013 upload, API-014 parse, API-015 status, API-016 remover | CertificadoCarregado, CertificadoProximoDoVencimento, CertificadoExpirado, CertificadoRemovido | Fluxo N/A (op admin) |
| F-013 Config fiscal | UC-016, UC-017 | (RPC + services/config) | fiscal-runtime-config (cross) | empresa_config, fiscal_runtime_config | API-022 runtime-config | EmpresaFiscalConfigurada, AmbienteAlterado, SerieRotacionada | — |
| F-014 Auditoria | UC-018, UC-019 | AuditoriaService | fiscal-audit | fiscal_auditoria | API-020 auditoria/consultar | AuditoriaConsultada | Transversal |
| F-015 Monitoramento | UC-020, UC-021 | MonitoramentoService | (agrega) | fiscal_telemetria, cron_health | (leitura de views + RPCs) | AlertaFiscalDisparado | Transversal |
| F-016 Retry | UC-022, UC-023 | AutorizacaoService/EventoService | fiscal-queue-manager | pgmq.fiscal.retry.* | API-017 fiscal-cron | RetryExecutado, RetryEsgotado, MensagemArquivadaDLQ, FilaProcessada | Fluxo 13 |
| F-017 Contingência | UC-024, UC-025, UC-032 | ContingenciaService | fiscal-contingency-manager | notas_fiscais (tpEmis), fiscal_runtime_config | (via RPC admin) | ContingenciaAtivada, ContingenciaEncerrada | Fluxo 14/15 |
| F-018 Export lote | UC-026 | ExportacaoService | fiscal-module-nfe (parcial) | notas_fiscais, bucket | API-004 exportar-xml (lote) | XMLExportado, FilaProcessada | Fluxo 10 |
| F-019 Validação standalone | UC-027 | ValidacaoService | fiscal-schema + module | fiscal_schemas_pl | (RPC/dev tool) | DocumentoValidadoLocalmente | Fluxo 11 |
| F-020 Assinatura standalone | UC-028 | AssinaturaService | fiscal-signature | — | (RPC/dev tool) | DocumentoAssinado | Fluxo 12 |
| F-021 Endpoints | UC-029 | (RPC admin) | fiscal-endpoint-registry | fiscal_endpoints | API-021 endpoints/* | EndpointAlterado, EndpointResolvido | Transversal |
| F-022 PL/XSD | UC-030 | (RPC admin) | fiscal-schema-registry | fiscal_schemas_pl, bucket | (op admin) | — | Transversal |
| F-023 Notificação | (agregado) | NotificacaoFiscalService | fiscal-notification-service | (reusa infra e-mail/in-app) | (interno) | AlertaFiscalDisparado | Reativo |
| F-024 Webhooks (v3) | — | WebhookService | fiscal-webhook | webhooks_saida | API-023 | WebhookEntregue, WebhookFalhou | Reativo |
| F-025 SPED (v3) | — | SpedService | fiscal-module-sped | notas_fiscais, itens, estoque, financeiro | (RPC admin) | (interno) | Fluxo próprio |
| F-026 EFD-Reinf/eSocial (v3) | — | EFDReinfService, ESocialService | fiscal-module-reinf, fiscal-module-esocial | (novas tabs) | (novas) | (novos eventos) | Fluxo próprio |

## Rastreabilidade reversa (por ADR)

| ADR | Funcionalidades afetadas |
|---|---|
| ADR-001 (runtime nativo) | todas |
| ADR-002 (C14N própria) | F-001, F-006–F-008, F-020 |
| ADR-003 (endpoint registry) | F-001, F-002, F-006–F-011, F-021 |
| ADR-004 (signature suite) | F-001, F-006–F-008, F-020 |
| ADR-005 (plugin por documento) | F-001, F-005, F-009, extensibilidade |
| ADR-006 (empresa_id v1) | todas |
| ADR-007 (fila vs síncrono) | F-009, F-016, F-018 |
| ADR-008 (storage XML/XSD) | F-001, F-003, F-004, F-018, F-019, F-022 |
| ADR-009 (6 camadas) | todas |
| ADR-010 (bounded contexts) | todas |
| ADR-011 (modular monolith edges) | todas |
| ADR-012 (Idempotency-Key) | API escritas |
| ADR-013 (contingência manual) | F-017 |
| ADR-014 (envelope padrão) | todas APIs |
| ADR-015 (correlation-first) | F-014, F-015 |
| ADR-016 (strangler) | migração de F-001, F-006–F-011 |

## Rastreabilidade reversa (por entidade)

| Entidade | Funcionalidades que escrevem | Consultadas por |
|---|---|---|
| `notas_fiscais` | F-001, F-004, F-006, F-009, F-017 | F-002, F-003, F-014, F-015, F-018, F-020 |
| `notas_fiscais_itens` | F-001, F-004 | F-018 |
| `nota_fiscal_eventos` | F-005, F-006, F-007 | F-014, F-019 |
| `nota_fiscal_anexos` | F-001, F-004 | F-003, F-018 |
| `inutilizacoes_numeracao` | F-008 | F-014, F-021 (validação) |
| `nfe_distribuicao` | F-009 | F-005, F-010, F-014 |
| `nfe_distribuicao_itens` | F-009 | F-014 |
| `nfe_distdfe_sync` | F-009 | F-015 |
| `fiscal_endpoints` | F-021 | F-001, F-002, F-005–F-011 |
| `fiscal_auditoria` | todas | F-014, F-015 |
| `fiscal_runtime_config` | F-013, F-017 | todas |
| `fiscal_schemas_pl` | F-022 | F-001, F-019 |
| `fiscal_certificado_metadata` | F-012 | F-001, F-005–F-011, F-020 |
| `fiscal_idempotency` | todas (via header) | todas |
| `fiscal_telemetria` | todas | F-015 |
| pgmq.fiscal.* | F-016 (produz/consome) | F-009, F-018 |

## Rastreabilidade por RN (amostra crítica)

| RN | UC | F | Onde valida |
|---|----|---|-------------|
| RN-002/003 (chave/DV) | UC-001 | F-001 | fiscal-module-nfe.serialize + VO ChaveAcesso |
| RN-005 (numeração) | UC-001 | F-001 | series_numeracao + RPC atômica |
| RN-006 (homologação) | UC-001 | F-001 | fiscal-module-nfe.serialize (guard) |
| RN-080 (24h cancel) | UC-006 | F-006 | Application layer + banco (`dh_autorizacao`) |
| RN-092 (nSeq CCe) | UC-007 | F-007 | UNIQUE + Application |
| RN-101 (faixa livre) | UC-008 | F-008 | trigger + query |
| RN-110 (NSU monotônico) | UC-009 | F-009 | UNIQUE + Application |
| RN-155 (CNPJ cert) | UC-013 | F-012 | CertificadoService.upload |
| RN-500 (empresa_id JWT) | todas | todas | edge auth guard |
| RN-520 (audit anti-tamper) | UC-018 | F-014 | trigger em `fiscal_auditoria` |

A matriz completa RN×UC×Módulo fica disponível como consulta ad-hoc (usar rg em `docs/fiscal-framework/etapa-3/41-*.md` e `49-*.md`).