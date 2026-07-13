# ADR-008 — Armazenamento de XMLs e XSDs no bucket `dbavizee`

**Status**: aceito · **Data**: 2026-07-13

## Contexto
XMLs autorizados devem ficar 5 anos (obrigação legal). XSDs de cada Pacote
de Liberação precisam estar acessíveis à edge para validação opcional.
Manter tudo em bucket privado unifica governança.

## Decisão

**XMLs**: `dbavizee/fiscal/{yyyy}/{mm}/{entrada|saida}/{chave}.xml` (padrão vigente — manter).
**XSDs**: `dbavizee/fiscal/schemas/PL_{codigo}_v{versao}/` ex.: `dbavizee/fiscal/schemas/PL_010_v1_00/leiauteNFe_v4.00.xsd`.
**Metadados dos XSDs**: `fiscal_schemas_pl (documento, versao_pl, vigente_de, vigente_ate, storage_prefix)`.
**Certificado**: `dbavizee/certificados/[{empresaId}/]empresa.pfx` (padrão vigente — manter).

## Consequências
Um bucket, uma política de RLS por prefixo. Backup e retenção configuráveis
por prefixo. Migração para novo PL = novo prefixo + linha em
`fiscal_schemas_pl`; runtime resolve automaticamente.

## Referência
`mem/security/storage-dbavizee-prefixos.md`; `mem/features/arquivamento-xml-nfe.md`.