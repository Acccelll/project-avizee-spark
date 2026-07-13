# 10 · Modelo de dados conceitual do Framework Fiscal

**Sem DDL.** Apenas entidades, atributos essenciais, relações e razão de existir.
Migrations ficam para etapas futuras (backlog no doc 18).

## Entidades **que já existem** (reaproveitadas)

| Entidade | Papel no framework |
|----------|--------------------|
| `notas_fiscais` | NF de saída/entrada — persistência final |
| `notas_fiscais_itens` | Itens |
| `nota_fiscal_eventos` / `eventos_fiscais` | Eventos (cancel, CCe, manif) |
| `nota_fiscal_anexos` | Anexos (XML, PDF DANFE) |
| `nfe_distribuicao` | Documentos recebidos por DistDFe |
| `nfe_distribuicao_itens` | Itens dos documentos recebidos |
| `nfe_distdfe_sync` | Cursor NSU por CNPJ+ambiente |
| `nfe_emissao_pendente` | Fila leve de retry (será migrada para pgmq) |
| `inutilizacoes_numeracao` | Faixas inutilizadas |
| `matriz_fiscal` | Regra tributária |
| `naturezas_operacao` | CFOP default |
| `empresa_config` | Emitente (CNPJ, IE, CRT, série, ambiente) |
| `app_configuracoes` | Metadados cert + runtime |
| `fiscal_telemetria` | Métricas (parcial hoje; ampliar) |
| `sefaz_consulta_log` | Log bruto (será substituído por `fiscal_auditoria`) |

## Entidades **novas** (propostas — sem DDL)

### `fiscal_endpoints`
**Papel**: registry declarativo de URLs SEFAZ (ADR-003).
**Atributos essenciais**:
- `documento` ('NFe' | 'NFCe' | 'CTe' | 'MDFe' | 'NFSe')
- `uf` (código IBGE — 11 a 53; 91 = AN)
- `ambiente` ('homologacao' | 'producao')
- `servico` (ServicoFiscal)
- `versao` (ex.: '4.00')
- `url`
- `atualizado_em`, `fonte` (texto — comentário sobre origem)
**Único**: `(documento, uf, ambiente, servico, versao)`.
**Semente**: migration inicial com autorizadores próprios + SVAN + SVRS + AN.

### `fiscal_auditoria`
**Papel**: rastro completo de toda comunicação com SEFAZ.
**Atributos**:
- `empresa_id`, `correlation_id`, `operacao` (autorizar, cancelar, dfe_sync…),
- `ator` (`auth.uid()`), `timestamp`
- `documento`, `chave_acesso` (nullable)
- `request_hash` (SHA-256 do body enviado, sem armazenar o XML completo)
- `response_status`, `cstat`, `xmotivo`
- `duracao_ms`, `endpoint_url`
- `retryable`, `tentativa` (ordinal)
**Retenção**: 5 anos (obrigação legal — Ajuste SINIEF 07/05).
**RLS**: leitura por perfil `fiscal_admin`.

### `fiscal_certificado_metadata` (opcional, se separar de `app_configuracoes`)
**Papel**: metadados por empresa (multi-tenant).
**Atributos**: `empresa_id`, `cnpj`, `razao_social`, `validade_inicio`, `validade_fim`, `storage_path`, `vault_secret_name`, `atualizado_em`.
**Alternativa**: manter em `app_configuracoes` com chave composta `certificado_digital:{empresaId}`.

### `fiscal_runtime_config`
**Papel**: configurações do motor por empresa.
**Atributos**: `empresa_id`, `sync_auto_ciencia`, `timeout_autorizacao_ms`, `timeout_status_ms`, `politica_retry` (jsonb), `contingencia_habilitada`.
**Padrão**: linha default `empresa_id = null` (aplicável a todas).

### `fiscal_schemas_pl`
**Papel**: metadados dos Pacotes de Liberação XSD.
**Atributos**: `documento`, `versao_pl`, `vigente_de`, `vigente_ate`, `storage_prefix` (ex.: `fiscal/schemas/PL_010_v1_00/`).
**Uso**: `SchemaValidator` resolve XSD por (documento, versao_pl) em runtime.

## Filas (pgmq — não são tabelas relacionais)

| Fila | Payload | Consumidor |
|------|---------|------------|
| `fiscal.retry.autorizacao` | `{ nRec, empresaId, correlationId, tentativa }` | `fiscal-cron` |
| `fiscal.retry.evento` | `{ chave, tpEvento, nSeq, empresaId, tentativa }` | `fiscal-cron` |
| `fiscal.dfe.sync` | `{ empresaId }` | `fiscal-cron` (a cada 30 min) |
| `fiscal.eventos.ciencia` | `{ chave, empresaId }` | `fiscal-cron` (após DFe se auto=true) |

## Relacionamentos-chave

```
empresas 1──N empresa_config
empresas 1──N notas_fiscais
empresas 1──N nfe_distribuicao
empresas 1──N fiscal_auditoria
empresas 1──1 fiscal_runtime_config
empresas 1──1 fiscal_certificado_metadata

notas_fiscais 1──N notas_fiscais_itens
notas_fiscais 1──N nota_fiscal_eventos
notas_fiscais 1──N nota_fiscal_anexos

nfe_distribuicao 1──N nfe_distribuicao_itens
nfe_distdfe_sync 1──1 (empresa_id, ambiente)

fiscal_endpoints — sem FK (tabela de referência)
fiscal_schemas_pl — sem FK (tabela de referência)
```

## Constraints obrigatórias (conceito)

- `notas_fiscais.chave_acesso` UNIQUE por empresa.
- `nota_fiscal_eventos (chave_acesso, tp_evento, n_seq_evento)` UNIQUE — **idempotência**.
- `nfe_distribuicao (empresa_id, chave_acesso)` UNIQUE.
- `nfe_distdfe_sync (empresa_id, ambiente)` UNIQUE.
- `inutilizacoes_numeracao (empresa_id, ano, serie, n_inicial, n_final)` UNIQUE.
- `fiscal_endpoints (documento, uf, ambiente, servico, versao)` UNIQUE.
- Check constraints (`chk_`) em enums textuais (`ambiente`, `status_sefaz`, `documento`).

## RLS (conceito)

- Padrão: `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())`.
- `fiscal_endpoints` e `fiscal_schemas_pl`: leitura livre (`authenticated`), escrita `admin`.
- `fiscal_auditoria`: leitura por `fiscal_admin`; escrita apenas via service_role (edges).

## GRANTs (regra Core do projeto)

Toda nova tabela em `public` exigirá GRANTs explícitos no mesmo migration:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
```
Tabelas de referência (`fiscal_endpoints`, `fiscal_schemas_pl`) podem
conceder `SELECT` a `anon` se a UI pública precisar (não é o caso hoje).

## O que **não** entra no modelo

- XML completo do request/response em coluna — só hash. XML vai para Storage.
- Certificado — nunca em tabela relacional, só bucket + Vault.
- Senha de certificado — nunca em tabela, só Vault.