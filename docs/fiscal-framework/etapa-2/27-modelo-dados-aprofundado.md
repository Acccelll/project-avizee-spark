# 27 · Modelo de dados aprofundado

Refina o doc 10 da Etapa 1 acrescentando **agregados, integridade, versionamento,
auditoria, soft delete e rastreabilidade**. Continua **sem DDL**.

## Agregados (raiz e limites transacionais)

| Agregado (raiz) | Membros | Invariante |
|---|---|---|
| `NotaFiscal` | `notas_fiscais_itens`, `nota_fiscal_anexos`, `nota_fiscal_eventos` | soma itens = totais; status coerente com eventos; chave única por empresa |
| `DistribuicaoDFe` | `nfe_distribuicao`, `nfe_distribuicao_itens` | chave única por empresa; NSU monotônico crescente |
| `Inutilizacao` | linha única em `inutilizacoes_numeracao` | faixa não sobrepõe outra inutilização/emissão |
| `EndpointRegistry` | `fiscal_endpoints` | `(documento,uf,ambiente,servico,versao)` UNIQUE |
| `AuditoriaRastro` | `fiscal_auditoria` (append-only) | write-once, sem UPDATE |
| `CertificadoConfig` | bucket + Vault + `fiscal_certificado_metadata` | metadados refletem PFX vigente |
| `RuntimeConfig` | `fiscal_runtime_config` | 1 linha por empresa + 1 default |
| `SchemasPL` | `fiscal_schemas_pl` + prefixo storage | vigência não sobrepõe para mesmo documento |

**Regra**: transação escreve dentro de **um único agregado**. Cross-agregado é
coordenado por evento/fila, não por transação distribuída.

## Regras de integridade

### Referencial
- `notas_fiscais.empresa_id → empresas.id` (RESTRICT).
- `notas_fiscais_itens.nota_id → notas_fiscais.id` (CASCADE delete).
- `nota_fiscal_eventos.nota_id → notas_fiscais.id` (RESTRICT — evento não some).
- `fiscal_endpoints`, `fiscal_schemas_pl`: sem FK (referência).

### Constraints de domínio (`chk_`)
- `ambiente IN ('homologacao','producao')`.
- `status_sefaz IN ('Rascunho','Emitida','Autorizada','Rejeitada','Denegada','Cancelada','Inutilizada','Contingencia')`.
- `documento IN ('NFe','NFCe','CTe','MDFe','NFSe')`.
- `tp_evento IN ('110110','110111','110140','210200','210210','210220','210240', ...)`.
- `chave_acesso` — regex 44 dígitos + dígito verificador via CHECK/trigger.
- `numero > 0`, `serie >= 0`.

### Unicidade (idempotência natural)
- `notas_fiscais (empresa_id, chave_acesso)` UNIQUE.
- `nota_fiscal_eventos (chave_acesso, tp_evento, n_seq_evento)` UNIQUE.
- `nfe_distribuicao (empresa_id, chave_acesso)` UNIQUE.
- `nfe_distdfe_sync (empresa_id, ambiente)` UNIQUE.
- `inutilizacoes_numeracao (empresa_id, ano, serie, n_inicial, n_final)` UNIQUE.
- `fiscal_endpoints (documento, uf, ambiente, servico, versao)` UNIQUE.
- `fiscal_idempotency (empresa_id, key)` UNIQUE.

## Versionamento

Duas dimensões:

### Versão do XML (layout SEFAZ)
- Coluna `versao_layout` (ex.: '4.00') em `notas_fiscais`.
- Nunca migrar retroativamente XMLs autorizados — congelam no layout emitido.
- Novos documentos usam versão vigente conforme `fiscal_schemas_pl`.

### Versão de aplicação
- Migração destrutiva de coluna proibida — sempre `ADD COLUMN` + backfill + `DROP` em migration separado, com no mínimo 1 release entre eles.
- `fiscal_endpoints.versao` permite coexistência de 4.00 (atual) e 5.00 (quando SEFAZ publicar), com feature flag `fiscal:v2:nfe-5-00`.

## Auditoria

### `fiscal_auditoria` (append-only)
- Retenção mínima 5 anos (Ajuste SINIEF 07/05).
- Bloqueio de UPDATE/DELETE via trigger + RLS.
- Índice `(empresa_id, timestamp DESC)`, `(correlation_id)`, `(chave_acesso)`.
- Particionamento por mês (planejado para Etapa 6+; opcional até 100k linhas/mês).

### Rastreabilidade
Todo registro operacional carrega `correlation_id`. Cadeia completa:
```
notas_fiscais.correlation_id_emissao
nota_fiscal_eventos.correlation_id
fiscal_auditoria.correlation_id
```
Uma query única (`SELECT * FROM fiscal_auditoria WHERE correlation_id = ?`) reconstrói o fluxo end-to-end.

## Soft delete

### O que **não** admite soft delete
- `notas_fiscais` (dever fiscal 5 anos — usar `status` para "cancelar"/"inutilizar").
- `nota_fiscal_eventos` (registro imutável).
- `fiscal_auditoria` (append-only).
- `nfe_distribuicao` (documento fiscal recebido).

### O que admite soft delete (`deleted_at` + `deleted_by`)
- `fiscal_endpoints` (dado de referência — soft mantém histórico de URLs antigas).
- `fiscal_runtime_config`.
- `fiscal_schemas_pl` (marca não-vigente em vez de deletar).

### Regra
- Views padrão filtram `deleted_at IS NULL`.
- Consulta histórica usa view `*_all`.

## Histórico e trilha

### Estratégia
- Tabelas mutáveis relevantes ganham gêmea `_hist` (ou coluna `versao` + linha nova) — opcional por tabela, decidido caso a caso.
- Sem CDC nativo (não há Debezium na Lovable) — auditoria via triggers + `fiscal_auditoria` para operações fiscais críticas.

### Prioridade
1. `notas_fiscais` — histórico via `nota_fiscal_eventos` (já é natural).
2. `fiscal_endpoints` — histórico via `atualizado_em` + soft delete.
3. `fiscal_runtime_config` — histórico opcional (baixo volume, mudanças raras).

## Rastreabilidade multi-empresa/filial

### Multi-empresa (v1: preparado, não ativo)
- Toda tabela fiscal com `empresa_id UUID NOT NULL`.
- RLS default: `empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid())`.
- Chaves compostas de idempotência sempre iniciam por `empresa_id`.

### Multi-filial (v2)
- `filial_id UUID NULL` em `notas_fiscais` e derivados.
- Numeração pode ser por filial (série própria) — `series_numeracao (empresa_id, filial_id, documento, serie)`.
- Certificado por filial: prefixo storage `certificados/{empresaId}/{filialId}/empresa.pfx`.

### Multi-ambiente
- `ambiente` já é coluna. Cascatas RLS + UNIQUE por `(empresa_id, ambiente, ...)` para separar hom/prod.
- Numeração isolada por ambiente (sequences distintas).

## Estratégia de particionamento (futuro)

| Tabela | Chave | Quando |
|---|---|---|
| `fiscal_auditoria` | `RANGE (timestamp)` mensal | > 100k linhas/mês por tenant |
| `nfe_distribuicao` | `RANGE (dh_emi)` mensal | > 50k linhas/mês |
| `notas_fiscais` | opcional `LIST (ambiente)` | multi-tenant > 20 empresas |

Não aplicar antes de necessário (custo operacional).

## Migrations (regra reafirmada)

Toda nova tabela do framework em `public.fiscal_*`:
1. `CREATE TABLE`
2. `GRANT` (SELECT/INSERT/UPDATE/DELETE authenticated; ALL service_role; skip anon)
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. `CREATE POLICY`
5. `TRIGGER update_updated_at_column`
6. `COMMENT ON TABLE` obrigatório

Nenhuma migration é criada nesta etapa.