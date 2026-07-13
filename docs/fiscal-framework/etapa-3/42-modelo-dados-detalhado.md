# 42 · Modelo de dados detalhado

Refina docs 10 (Etapa 1) e 27 (Etapa 2). **Sem DDL.** Padrão de ficha:

```
Entidade
  Finalidade
  Campos-chave
  Relacionamentos e cardinalidade
  Integridade
  Índices recomendados
  Auditoria
  Versionamento
  Retenção
```

Campos padrão omitidos: `id UUID PK`, `created_at`, `updated_at`, `created_by`, `updated_by`.

## Entidades existentes reaproveitadas

### `notas_fiscais` (agregado raiz)
- **Finalidade**: documento fiscal emitido ou recebido.
- **Campos-chave**: `empresa_id`, `chave_acesso UNIQUE(empresa_id, chave_acesso)`, `modelo`, `serie`, `numero`, `natureza_operacao`, `tipo_operacao (E|S)`, `finalidade`, `emitente_id`, `destinatario_id`, `ambiente`, `status_sefaz`, `cstat`, `xmotivo`, `protocolo`, `dh_autorizacao`, `dh_emi`, `dh_sai_ent`, `versao_layout`, `caminho_xml`, `caminho_danfe`, `valor_total`, `valor_produtos`, `valor_frete`, `valor_desconto`, `informacoes_complementares`, `correlation_id_emissao`.
- **Relacionamentos**: `1:N notas_fiscais_itens`, `1:N nota_fiscal_eventos`, `1:N nota_fiscal_anexos`.
- **Integridade**: `chk_ambiente`, `chk_status_sefaz`, `chk_modelo IN (55,65)`, `chk_serie >= 0`, `chk_numero > 0`, DV da chave.
- **Índices**: `(empresa_id, dh_emi DESC)`, `(empresa_id, status_sefaz)`, `(chave_acesso)`, `(empresa_id, tipo_operacao, dh_emi)`.
- **Auditoria**: eventos em `fiscal_auditoria` + trilha em `nota_fiscal_eventos`.
- **Versionamento**: `versao_layout` congela; alterações estruturais só via evento.
- **Retenção**: 5 anos (não soft delete).

### `notas_fiscais_itens`
- **Campos-chave**: `nota_id FK`, `numero_item`, `produto_id`, `cfop`, `ncm`, `cest`, `origem`, `cst`, `csosn`, `q_com`, `v_un_com`, `v_prod`, `q_trib`, `v_un_trib`, `ind_tot`, `v_desconto`, `impostos_json`.
- **Integridade**: `numero_item > 0`, `(nota_id, numero_item)` UNIQUE.
- **Índices**: `(nota_id, numero_item)`, `(produto_id, dh_emi)` (via join).

### `nota_fiscal_eventos`
- **Finalidade**: eventos fiscais (cancel, CCe, manif, inut).
- **Campos-chave**: `chave_acesso`, `nota_id?`, `tp_evento`, `n_seq_evento`, `x_evento`, `justificativa`, `n_prot`, `dh_evento`, `xml_bytes_path`, `status`.
- **Integridade**: `(chave_acesso, tp_evento, n_seq_evento)` UNIQUE.
- **Índices**: `(chave_acesso, dh_evento DESC)`, `(nota_id)`, `(tp_evento, dh_evento)`.
- **Retenção**: 5 anos.

### `nfe_distribuicao` / `nfe_distribuicao_itens`
- **Campos-chave**: `empresa_id`, `chave_acesso`, `cnpj_emitente`, `nsu`, `schema`, `xml_path`, `dh_emi`, `dh_recbto`, `status_manifestacao`, `documento IN ('NFe','CTe','EventoNFe','ResumoNFe','CancelamentoNFe')`.
- **Integridade**: `(empresa_id, chave_acesso)` UNIQUE; NSU só cresce por `(empresa_id, ambiente)`.
- **Índices**: `(empresa_id, nsu)`, `(chave_acesso)`, `(empresa_id, cnpj_emitente, dh_emi)`.
- **Retenção**: 5 anos.

### `nfe_distdfe_sync`
- **Campos**: `empresa_id`, `ambiente`, `ultimo_nsu`, `ultimo_max_nsu`, `atualizado_em`, `duracao_ultima_ms`, `cstat_ultimo`.
- **Integridade**: `(empresa_id, ambiente)` UNIQUE.

### `inutilizacoes_numeracao`
- **Campos**: `empresa_id`, `ano`, `serie`, `n_inicial`, `n_final`, `justificativa`, `n_prot`, `dh_recbto`, `xml_path`.
- **Integridade**: `(empresa_id, ano, serie, n_inicial, n_final)` UNIQUE; `n_inicial <= n_final`.

### `matriz_fiscal` / `naturezas_operacao` / `empresa_config`
- Já documentados; sem mudança estrutural na Etapa 3.

## Entidades novas

### `fiscal_endpoints`
- **Finalidade**: registry declarativo (ADR-003).
- **Campos**: `documento`, `uf`, `ambiente`, `servico`, `versao`, `url`, `fonte`, `atualizado_em`, `deleted_at`.
- **Integridade**: `(documento, uf, ambiente, servico, versao) WHERE deleted_at IS NULL` UNIQUE; check `documento IN(...)`, `ambiente IN(...)`, `servico IN(...)`.
- **Índices**: `(uf, ambiente)`, `(documento, servico)`.
- **Auditoria**: `fiscal_auditoria.operacao='endpoint_alterado'`.
- **Versionamento**: soft delete + histórico via `atualizado_em`.
- **Retenção**: histórico permanente.

### `fiscal_auditoria` (append-only)
- **Finalidade**: rastro fiscal (5 anos legais).
- **Campos**: `empresa_id`, `correlation_id`, `operacao`, `ator UUID`, `timestamp`, `documento?`, `chave_acesso?`, `request_hash CHAR(64)`, `response_status INT`, `cstat?`, `xmotivo?`, `duracao_ms INT`, `endpoint_url TEXT`, `retryable BOOL`, `tentativa INT`, `payload_extra JSONB`.
- **Integridade**: trigger anti-tamper (RAISE em UPDATE/DELETE).
- **Índices**: `(empresa_id, timestamp DESC)`, `(correlation_id)`, `(chave_acesso)`, `(operacao, timestamp DESC)`.
- **Retenção**: 5 anos mínimo; particionar mensal quando > 100k linhas/mês.
- **RLS**: SELECT `fiscal:auditoria`; INSERT `service_role`; UPDATE/DELETE bloqueado.

### `fiscal_runtime_config`
- **Campos**: `empresa_id? UNIQUE`, `sync_auto_ciencia BOOL`, `timeout_autorizacao_ms INT`, `timeout_status_ms INT`, `politica_retry JSONB`, `contingencia_habilitada BOOL`, `parallelism JSONB`.
- **Integridade**: 1 linha por empresa + 1 default (`empresa_id IS NULL`).
- **Retenção**: soft delete; histórico via auditoria.

### `fiscal_schemas_pl`
- **Campos**: `documento`, `versao_pl`, `vigente_de DATE`, `vigente_ate DATE NULL`, `storage_prefix TEXT`, `notas TEXT`.
- **Integridade**: EXCLUDE constraint garante não-sobreposição de vigência por `(documento)`.
- **Índices**: `(documento, vigente_de DESC)`.

### `fiscal_certificado_metadata` (opcional — v2)
- **Campos**: `empresa_id UNIQUE`, `cnpj CHAR(14)`, `razao_social`, `validade_inicio`, `validade_fim`, `storage_path`, `vault_secret_name`, `serial`, `subject_cn`, `atualizado_em`.
- **Índices**: `(validade_fim)` para cron alertas.

### `fiscal_idempotency`
- **Campos**: `empresa_id`, `key TEXT`, `response_hash CHAR(64)`, `response_status INT`, `expira_em`.
- **Integridade**: `(empresa_id, key)` UNIQUE.
- **Retenção**: 24h; cron limpa.

### `fiscal_circuit_state` (opcional — Etapa 7)
- **Campos**: `uf`, `ambiente`, `servico`, `estado ENUM('closed','open','half')`, `falhas_seguidas INT`, `aberto_desde`, `ultima_verificacao`.
- **Integridade**: `(uf, ambiente, servico)` UNIQUE.

### `fiscal_telemetria` (existente, ampliar)
- **Campos-chave**: `empresa_id?`, `metrica`, `valor NUMERIC`, `labels JSONB`, `timestamp`.
- **Índices**: `(metrica, timestamp DESC)`, GIN em `labels`.
- **Retenção**: 90 dias raw; agregados diários por 2 anos.

### `fiscal_api_keys` (futuro v2)
- **Campos**: `empresa_id`, `chave_hash CHAR(60) UNIQUE` (bcrypt), `escopos TEXT[]`, `nome`, `expira_em`, `ultimo_uso`.

### `series_numeracao` (multi-filial — v2)
- **Campos**: `empresa_id`, `filial_id?`, `documento`, `serie`, `proximo_numero BIGINT`, `ambiente`.
- **Integridade**: `(empresa_id, filial_id, documento, serie, ambiente)` UNIQUE.
- **Nota**: atualização via RPC atômico (padrão `numeracao-atomica-documentos`).

### `fiscal_nfse_padroes` / `fiscal_nfse_municipios` (v3 NFS-e)
- Documentados em doc 33 (extensibilidade).

### `webhooks_saida` (v3)
- Reusa infra `mem/features/webhooks-saida`; campos fiscais herdados.

## Constraints obrigatórias transversais

- Toda tabela `fiscal_*` tem `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Toda tabela mutável tem trigger `update_updated_at_column`.
- Toda tabela operacional tem RLS ativa + policy.
- Toda migration segue estrutura do doc 27 §Migrations (CREATE → GRANT → RLS → POLICY → TRIGGER → COMMENT).

## Estratégia de retenção

| Categoria | Retenção | Base |
|---|---|---|
| Docs fiscais autorizados (XML, dados) | 5 anos | Ajuste SINIEF 07/05 |
| Eventos fiscais | 5 anos | idem |
| Auditoria | 5 anos | idem |
| DistDFe | 5 anos | idem |
| Telemetria raw | 90 dias | operacional |
| Telemetria agregada | 2 anos | operacional |
| Idempotency | 24h | operacional |
| Endpoints (soft-deleted) | permanente | histórico |
| Certificado (pfx no bucket) | vida útil + 5 anos após substituição | prova de assinatura |

## Estratégia de particionamento (futuro)

| Tabela | Chave | Gatilho |
|---|---|---|
| `fiscal_auditoria` | RANGE(timestamp) mensal | > 100k linhas/mês |
| `nfe_distribuicao` | RANGE(dh_emi) mensal | > 50k linhas/mês |
| `notas_fiscais` | LIST(ambiente) opcional | multi-tenant grande |
| `fiscal_telemetria` | RANGE(timestamp) mensal | > 1M linhas/mês |

## Views recomendadas

- `v_fiscal_saude_diaria` — agregação por empresa/dia (total, autorizadas, rejeitadas, tempo médio).
- `v_fiscal_saude_sefaz` — cStat atual + duração última por (uf, ambiente).
- `v_fiscal_certificados_alerta` — certificados a < 30d de expirar.
- `v_nfe_portal` (existente) — visão consolidada para tela `/fiscal/portal`.
- `v_fiscal_apuracao` (v3) — pré-agregação SPED.
- `v_fiscal_timeline_correlation` — reconstrução de operação por correlation_id.

## Integridade cross-tabela (regras de trigger/CHECK)

- `nota_fiscal_eventos` só insere se `chave_acesso` existe em `notas_fiscais` **ou** `nfe_distribuicao` (manifestação).
- `notas_fiscais.status='Cancelada'` requer evento cancel autorizado em `nota_fiscal_eventos`.
- `inutilizacoes_numeracao.n_inicial..n_final` não pode sobrepor emissões em `notas_fiscais` da mesma empresa/série/ano.
- `estoque_movimentos` só gerado após `notas_fiscais.status='Autorizada'` (regra ERP existente).

## Auditoria de escrita (o que gera entrada em `fiscal_auditoria`)

- Toda operação SEFAZ (request + response).
- Toda mudança de `fiscal_endpoints`.
- Toda mudança de `fiscal_runtime_config`.
- Toda operação de certificado (upload, remoção).
- Toda leitura de dado pessoal fiscal (nome+CPF/CNPJ) por usuário — nível `debug` ampliável a `info` sob política LGPD.
- Toda alteração privilegiada (`editar_admin`).