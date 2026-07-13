# 19 · Convenções e nomenclaturas

Referência única para naming de código, tabelas, edges, buckets, secrets e eventos.

## Módulos (código TS)

```
src/fiscal-framework/
  core/               fiscal-core          contratos e VOs
  engines/xml/        fiscal-xml           writer + C14N
  engines/signature/  fiscal-signature     XMLDSig
  engines/schema/     fiscal-schema        XSD
  engines/soap/       fiscal-soap          envelope + descriptor
  engines/transport/  fiscal-transport     fetch mTLS
  cross/certificate/  fiscal-certificate-manager
  cross/clock/        fiscal-clock
  cross/logger/       fiscal-logger
  cross/audit/        fiscal-audit
  cross/queue/        fiscal-queue-manager
  cross/cache/        fiscal-cache-manager
  cross/idempotency/  fiscal-idempotency
  cross/endpoints/    fiscal-endpoint-registry
  modules/nfe/        fiscal-module-nfe
  modules/nfce/       fiscal-module-nfce   (futuro)
  modules/cte/        fiscal-module-cte    (futuro)
  modules/mdfe/       fiscal-module-mdfe   (futuro)
  modules/nfse/       fiscal-module-nfse   (futuro)
  modules/eventos/    fiscal-module-eventos
  modules/dfe/        fiscal-module-dfe
  modules/status/     fiscal-module-status
  runtime.ts          createFiscalRuntime
```

## Edge functions

| Nome | Papel |
|------|-------|
| `fiscal-nfe` | Autorização, consulta, status, importação (NF-e) |
| `fiscal-events` | Cancel, CCe, inutilização, manifestação |
| `fiscal-dfe` | Distribuição DF-e, download por chave |
| `fiscal-cert` | Upload / parse / remoção de certificado |
| `fiscal-cron` | Consumidor de todas as filas `fiscal.*` |

**Regra**: prefixo `fiscal-` para novas edges do framework; a camada legada
(`sefaz-proxy`, `sefaz-distdfe`, `process-*-cron`) mantém prefixos originais
até aposentadoria.

## Tabelas

| Existente (não mudar) | Nova |
|-----------------------|------|
| `notas_fiscais`, `notas_fiscais_itens` | `fiscal_endpoints` |
| `nota_fiscal_eventos`, `eventos_fiscais` | `fiscal_auditoria` |
| `nota_fiscal_anexos` | `fiscal_cstat_policy` |
| `nfe_distribuicao`, `nfe_distribuicao_itens` | `fiscal_schemas_pl` |
| `nfe_distdfe_sync`, `nfe_emissao_pendente` (deprecar) | `fiscal_runtime_config` |
| `inutilizacoes_numeracao`, `matriz_fiscal`, `naturezas_operacao` | `fiscal_certificado_metadata` (opcional) |
| `empresa_config`, `app_configuracoes` | |
| `fiscal_telemetria`, `sefaz_consulta_log` (deprecar) | |

**Regra**: novas tabelas do framework usam prefixo `fiscal_`.

## Filas pgmq

```
fiscal.retry.autorizacao
fiscal.retry.evento
fiscal.dfe.sync
fiscal.eventos.manif
fiscal.eventos.ciencia
```

**Formato**: `fiscal.<dominio>.<acao>` (kebab-case dentro dos segmentos, ponto entre).

## Storage (bucket `dbavizee`)

```
certificados/empresa.pfx                         # single-tenant vigente
certificados/{empresaId}/empresa.pfx             # multi-tenant futuro
fiscal/{yyyy}/{mm}/entrada/{chave}.xml
fiscal/{yyyy}/{mm}/saida/{chave}.xml
fiscal/schemas/PL_{codigo}_v{versao}/{arquivo}.xsd
```

## Secrets (Supabase Vault)

```
CERTIFICADO_PFX_SENHA                         # single-tenant vigente
CERTIFICADO_PFX_SENHA__{empresaId}            # multi-tenant futuro
```

**Regra**: sem `__` entre nome e sufixo confundível — usar sempre `__`
(dois underscores) como separador.

## Correlation-id

Formato: `flx-{yyyymmddhhmmss}-{6 chars random alfanumérico}` — ex.: `flx-20260713142530-a1b2c3`.

## Permissões RBAC

```
fiscal:emitir       fiscal:cancelar     fiscal:cce
fiscal:inutilizar   fiscal:manifestar   fiscal:dfe
fiscal:certificado  fiscal:auditoria    fiscal:admin
```

**Regra**: `dominio:acao` em minúsculas. `fiscal:admin` implica todas.

## Feature flags de migração

```
fiscal:v2:autorizacao     fiscal:v2:consulta     fiscal:v2:cancelamento
fiscal:v2:cce             fiscal:v2:inutilizacao fiscal:v2:manifestacao
fiscal:v2:distdfe         fiscal:v2:sign         fiscal:v2:schema
```

Granularidade fina permite corte gradual + rollback isolado.

## Nomes canônicos de conceito (usar sempre estes)

| Termo | Uso |
|-------|-----|
| **Documento fiscal** | NF-e, NFC-e, CT-e, MDF-e, NFS-e |
| **Autorizador** | UF que autoriza (próprio ou SVAN/SVRS) |
| **Ambiente** | `homologacao` \| `producao` (nunca `hom`/`prod` em código) |
| **Chave de acesso** | 44 dígitos; VO `ChaveAcesso` |
| **NSU** | Número Sequencial Único (DistDFe) |
| **cStat** | Código de status SEFAZ |
| **xMotivo** | Texto de status SEFAZ |
| **Protocolo** | nProt (número de protocolo autorizado) |
| **CSC** | Código de Segurança do Contribuinte (NFC-e) |
| **Correlation-id** | Identificador de rastro fim-a-fim |

## Anti-padrões (proibidos)

- URLs SEFAZ hardcoded em `.ts` (usar `fiscal_endpoints`).
- `console.*` (usar `src/lib/logger.ts`).
- `new Date()` em módulos fiscais (usar `runtime.clock.now()`).
- Senha ou `.pfx` em coluna de tabela.
- Bytes de XML em coluna de tabela (guardar hash + bucket path).
- `throw` para rejeição SEFAZ (usar `FiscalResult.erro`).
- Retry no transport (retry só no orquestrador).
- Edge sem `search_path = public` em RPC.
- Tabela pública sem GRANTs explícitos.
- RLS ausente ou aberta em tabela fiscal.