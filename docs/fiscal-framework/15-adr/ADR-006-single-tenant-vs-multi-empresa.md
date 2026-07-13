# ADR-006 — Contratos com `empresa_id` desde o início

**Status**: aceito · **Data**: 2026-07-13

## Contexto
AVIZEE está migrando para multi-empresa (Onda 1). Ignorar `empresa_id` agora
causa refactor em toda a camada fiscal depois.

## Decisão
Todos os contratos do runtime (`FiscalContext`, `CertificateProvider`,
`fiscal_auditoria`, filas pgmq, chaves de idempotência) **incluem
`empresa_id`** desde a v1. Persistência já ganha coluna + RLS por empresa.
UI single-tenant hoje passa `empresa_id` fixo — quando multi-tenant chegar,
só troca a origem do valor.

## Consequências
- Zero refactor quando multi-empresa for ligado.
- Certificado por empresa: bucket path e Vault secret sufixados com `empresaId`.
- RLS `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())`.

## Referência
`.lovable/memory/features/multi-tenant-onda1.md`.