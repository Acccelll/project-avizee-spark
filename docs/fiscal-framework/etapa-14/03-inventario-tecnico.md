# 03 — Inventário Técnico

## Módulos (`src/modules/fiscal/`)

| Módulo | Responsabilidade | Depende de |
|--------|------------------|------------|
| `core/` | Bootstrap, container, types comuns | — |
| `infrastructure/xml`, `signature`, `transport`, `soap` | Núcleo de comunicação (Etapa 5) | `core` |
| `infrastructure/events/eventBus` | Barramento in-process | `core` |
| `nfe/` | NF-e 4.00 (Etapa 6) | comunicação |
| `nfe/eventos/` | Cancelamento, CC-e, inutilização, manif, DF-e (Etapa 7) | `nfe`, comunicação |
| `recebimento/` | Parser universal, dedup, conciliação, workflow (Etapa 8) | eventBus |
| `escrituracao/` | Motor tributário parametrizável, apuração, livros, SPED base (Etapa 9) | eventBus |
| `operacional/` | Dashboard, monitor SEFAZ, pendências, notificações, prontidão (Etapa 10) | eventBus, `infrastructure/transport` |
| `homologacao/` | E2E, carga, hardening, auditoria arquitetural (Etapa 11) | todos |
| `compliance/` | Compliance Engine, versionamento legal, Reforma Tributária, roadmap (Etapa 12) | eventBus |
| `platform/` | Núcleo agnóstico + registries + SDK + template (Etapa 13) | — |

## APIs públicas
`src/modules/fiscal/index.ts` expõe: `bootstrapFiscal`, `resetFiscal`, `FiscalContainer` e os namespaces `nfe`, `recebimento`, `escrituracao`, `operacional`, `homologacao`, `compliance`, `platform`.

## Eventos
Declarados em `infrastructure/events/eventBus.ts` e no Compliance/Platform. Prefixos:
`fiscal.endpoint.*`, `fiscal.config.*`, `fiscal.certificado.*`, `fiscal.auditoria.*`, `fiscal.queue.*`,
`fiscal.nfe.*`, `fiscal.recebimento.*`, `fiscal.escrituracao.*`, `fiscal.compliance.*`.
Regra: **fato passado** (ADR-017).

## Banco de dados (tabelas `fiscal_*`)
- `fiscal_endpoints`, `fiscal_runtime_config`, `fiscal_certificado_metadata`
- `fiscal_idempotency`, `fiscal_auditoria`, `fiscal_telemetria`
- `fiscal_circuit_state`, `fiscal_schemas_pl`
- `nfe_distribuicao`, `nfe_distribuicao_itens`, `nfe_distdfe_sync`, `nfe_emissao_pendente`
- `nota_fiscal_eventos`, `nota_fiscal_anexos`, `inutilizacoes_numeracao`, `eventos_fiscais`
- Todas com RLS + GRANTs conforme padrão do projeto.

## Filas
- `pgmq` para notificações (`process-email-queue`).
- Retries/backoff no `retryPolicy` + `circuitBreaker` (Etapa 5).

## Integrações
- **SEFAZ**: única saída via edge `sefaz-proxy` (Worker mTLS).
- **Distribuição DF-e**: `sefaz-distdfe`.
- **Certificados A1**: `assinar-e-enviar-vault` lê PFX de `dbavizee/certificados/` e senha do Vault.
