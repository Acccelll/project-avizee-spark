---
name: Framework Fiscal — arquitetura definitiva (Etapa 2)
description: Camadas, bounded contexts, edges canônicas, envelope de resposta e regra strangler; consultar antes de projetar qualquer serviço/edge/tabela fiscal
type: reference
---
A arquitetura oficial (ver `docs/fiscal-framework/etapa-2/`) segue:

**6 camadas** (ADR-009, doc 20): ERP → Fachada (edge `fiscal-*` + `services/fiscal/*`) → Application (use cases) → Domain (`fiscal-core` + modules por documento) → Infrastructure (engines + cross) → External (SEFAZ via mTLS, AN via proxy). Dependência estritamente descendente. Domain nunca importa Infra.

**9 bounded contexts** (ADR-010, doc 21): Configuração Fiscal · Certificados · Documentos Fiscais · Eventos · Comunicação SEFAZ · Distribuição DF-e · Manifestação · Auditoria · Monitoramento. Contratos entre contextos usam DTOs + eventos, nunca entidades.

**5 edges canônicas** (ADR-011): `fiscal-nfe`, `fiscal-events`, `fiscal-dfe`, `fiscal-cert`, `fiscal-cron`. Novos documentos entram como módulo plugável (`IFiscalDocumentModule`) — não novo edge por documento.

**Envelope padronizado** (ADR-014, doc 26): `SucessoEnvelope<T> { ok:true, data, correlationId, timestamp }` ou `ErroEnvelope { ok:false, error:{codigo,mensagem,recuperavel,cstat?,...}, correlationId, timestamp }`. HTTP status = transporte; regra de negócio em `error.codigo`. Rejeição SEFAZ = HTTP 200 com `ok:false` + `cstat`. Códigos canônicos: `FISCAL.REJEICAO/DENEGACAO/TIMEOUT/BREAKER_ABERTO/ENDPOINT_NAO_CADASTRADO/...`.

**Idempotência** (ADR-012): header `Idempotency-Key` obrigatório em API externa; tabela `fiscal_idempotency` armazena resposta 24h; conflito → 409.

**Contingência** (ADR-013): `fiscal-contingency-manager` apenas sugere; ativação exige `fiscal:admin` explícito — nunca automática.

**Observabilidade** (ADR-015): `correlation_id` como trace-id v1 (sem OTel); `fiscal_auditoria` é fonte de spans.

**Migração** (ADR-016): strangler por operação via `fiscal:v2:*`; coexistência mínima 60d antes do corte final. Nenhuma etapa vai a produção sem coexistência.

**How to apply:** ao propor nova edge, use uma das 5 canônicas com `action`; ao propor novo documento, crie plugin `IFiscalDocumentModule` (não nova edge); ao propor endpoint HTTP, use envelope padronizado + código canônico + correlation-id; ao propor mudança que contrarie ADR aceito, escreva `ADR-XXX-supersedes-ADR-YYY.md` antes.