---
name: Framework Fiscal — sumário dos ADRs
description: Referência rápida às 8 decisões arquiteturais aceitas na Etapa 1; consultar o ADR completo antes de contradizer
type: reference
---
ADRs aceitos (ver `docs/fiscal-framework/15-adr/`):

- **ADR-001** Runtime nativo TS/Deno; sem worker externo .NET.
- **ADR-002** C14N 1.0 própria em TS (sem `xml-crypto`, `node-forge`).
- **ADR-003** Endpoint Registry declarativo em tabela `fiscal_endpoints` (URLs SEFAZ = dado versionado).
- **ADR-004** `SignatureSuite` trocável (RSA-SHA1 hoje, RSA-SHA256 pronto para NT futura).
- **ADR-005** Plugin por documento via `IFiscalDocumentModule` (NF-e/NFC-e/CT-e/MDF-e/NFS-e como módulos).
- **ADR-006** `empresa_id` em todos os contratos desde v1 (preparado para multi-tenant sem refactor).
- **ADR-007** Fila pgmq para operações assíncronas (DistDFe, retry, ciência); síncrono para autorização/consulta/eventos por chave.
- **ADR-008** XMLs e XSDs no bucket `dbavizee` com prefixos versionados; metadados em `fiscal_schemas_pl`.

Antes de propor solução que contradiga um ADR, ler o ADR completo. Alteração de ADR aceito exige novo ADR (`ADR-XXX-supersedes-ADR-YYY.md`) e atualização deste sumário.