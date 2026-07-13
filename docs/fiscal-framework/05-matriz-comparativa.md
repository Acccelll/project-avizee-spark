# 05 · Matriz comparativa — AVIZEE × FiscalFramework

Legenda: ✅ presente/adequado · ⚠️ presente mas frágil · ❌ ausente · 🆕 oportunidade nova.

## Capacidades técnicas

| Capacidade | AVIZEE hoje | FiscalFramework | Decisão para o alvo |
|------------|-------------|-----------------|---------------------|
| Runtime | React/Vite (front) + Deno (edge) + Postgres | .NET 9 (BCL only) | **TS/Deno** (ADR-001) — sem worker externo |
| DI / composição | Import direto | `Create(options)` sem container | Fachada `createFiscalRuntime(options)` |
| Endpoint registry | ⚠️ hardcoded em `sefazUrls.service.ts` | ✅ `EndpointRegistry` declarativo | 🆕 tabela `fiscal_endpoints` versionada (ADR-003) |
| C14N 1.0 | ⚠️ via node-forge (incompleto) | ✅ implementação própria | 🆕 implementação própria em TS (ADR-002) |
| XMLDSig signer | ⚠️ node-forge | ✅ signer próprio com `SignatureSuite` ágil | 🆕 signer próprio + suite trocável (ADR-004) |
| Signature validator (terceiros) | ❌ | ✅ `ISignatureValidator` | 🆕 validador próprio |
| Schema validator (XSD) | ❌ | ✅ opcional, reporta pulado | 🆕 opcional, XSDs no Storage |
| SOAP envelope | ⚠️ manual por serviço | ✅ genérico via `SoapOperationDescriptor` | 🆕 engine SOAP única |
| SOAP double-wrapper (AN) | ⚠️ ad-hoc | ✅ descritor cobre ambos | 🆕 descritor único |
| Transport mTLS | ✅ (mas Deno TLS tem limites) | ✅ `HttpTransportChannel` | Manter Deno; documentar limites (doc 16) |
| Certificado A1 storage | ✅ bucket + Vault | ✅ providers | Manter padrão AVIZEE + adicionar hot-swap futuro |
| Certificados separados (sign vs transport) | ❌ (mesmo cert) | ✅ providers separados | Contrato prevê; default = mesmo cert |
| Fiscal clock | ❌ `new Date()` disperso | ✅ `IFiscalClock` | 🆕 `FiscalClock` injetável |
| Result pattern | ❌ exceções | ✅ `Result<T>` | 🆕 tipo `FiscalResult<T>` |
| Plugin por documento | ❌ tudo é NF-e | ✅ `IFiscalDocumentModule` | 🆕 contrato uniforme (ADR-005) |
| Multi-empresa | ⚠️ single-tenant | ⚠️ single-tenant | 🆕 contratos com `empresa_id` (ADR-006) |
| Correlation-id | ❌ | ⚠️ implícito | 🆕 obrigatório em toda operação |
| Idempotência de escrita | ✅ upsert por chave | N/A (não persiste) | Manter + estender a eventos |
| Persistência | ✅ Postgres/RLS | ❌ por decisão (ADR-08) | Manter no AVIZEE (vantagem sobre o framework) |
| Retry / backoff | ⚠️ `process-nfe-retry-cron` sem taxonomia | ❌ (fica no chamador) | 🆕 política declarativa por cStat (doc 12) |
| Fila | ⚠️ tabelas ad-hoc | ❌ | 🆕 pgmq para DistDFe/manifestação (ADR-007) |
| Validação de assinatura em NF-e de terceiros | ❌ | ✅ | 🆕 na importação DistDFe |

## Documentos suportados

| Documento | AVIZEE hoje | FiscalFramework | Alvo |
|-----------|-------------|-----------------|------|
| NF-e (55) | ✅ | ✅ | ✅ v1 |
| NFC-e (65) | ❌ | ❌ (roadmap) | 🆕 preparado (não implementado v1) |
| CT-e (57) | ❌ | ❌ (roadmap) | 🆕 preparado |
| MDF-e (58) | ❌ | ❌ (roadmap) | 🆕 preparado |
| NFS-e | ❌ | ❌ | 🆕 preparado (padrão nacional) |
| DF-e (distribuição) | ⚠️ frágil (endpoint quebrado) | ✅ | 🆕 nativo com registry |

## Serviços SEFAZ

| Serviço | AVIZEE hoje | Framework | Alvo |
|---------|-------------|-----------|------|
| Autorização (síncrona) | ✅ | ✅ | ✅ |
| Autorização (assíncrona + poll) | ⚠️ | ✅ | 🆕 orquestrado com fila |
| Consulta protocolo | ✅ | ✅ | ✅ |
| Status serviço | ✅ | ✅ | ✅ |
| Inutilização | ✅ | ✅ | ✅ |
| Consulta cadastro | ⚠️ | ✅ (contrato) | 🆕 |
| Recepção de evento (cancel/CCe/manif) | ✅ | ✅ | ✅ |
| Distribuição DF-e | ⚠️ quebrado | ✅ | 🆕 corrigido com registry |

## Segurança

| Aspecto | AVIZEE | Framework | Alvo |
|---------|--------|-----------|------|
| Certificado em Storage privado | ✅ | N/A | ✅ manter |
| Senha no Vault | ✅ | N/A | ✅ manter |
| RLS por perfil | ✅ | N/A | ✅ + adicionar por empresa |
| Mascaramento de log | ⚠️ inconsistente | N/A | 🆕 padronizado |
| Rotação de certificado | ⚠️ manual | ⚠️ hot-swap manual | 🆕 UI + alerta 30d |
| LGPD (dados fiscais) | ⚠️ | N/A | 🆕 documentado (doc 11) |

## Observabilidade

| Item | AVIZEE | Framework | Alvo |
|------|--------|-----------|------|
| Log estruturado | ⚠️ | N/A | 🆕 `logger.ts` + correlation-id |
| Auditoria (quem, quando) | ⚠️ | N/A | 🆕 tabela `fiscal_auditoria` |
| Métricas (latência SEFAZ) | ⚠️ `fiscal_telemetria` parcial | N/A | 🆕 completo |
| Health SEFAZ | ❌ | ✅ (status serviço) | 🆕 badge no dashboard |