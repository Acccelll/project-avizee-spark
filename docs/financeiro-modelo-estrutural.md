# Modelo Estrutural Oficial — Financeiro

## 1) Status financeiro canônico

### Persistido em `financeiro_lancamentos.status`
- `aberto`
- `parcial`
- `pago`
- `cancelado`

### Derivado (não persistido)
- `vencido`: calculado por `financeiro_status_efetivo(status, data_vencimento, data_ref)`
  quando `status = 'aberto'` e `data_vencimento < data_ref`.

> Regra: `vencido` deixa de ser fonte primária no banco e passa a ser situação temporal.

## 2) Baixa parcial / total / estorno

- A baixa é registrada em `financeiro_baixas`.
- O lançamento (`financeiro_lancamentos`) mantém apenas agregados: `valor_pago`, `saldo_restante`, `status`.
- O trigger `trg_sync_financeiro_saldo` recalcula agregados considerando **somente** baixas não estornadas.
- Estorno não remove histórico: marca baixa com `estornada_em` e preserva trilha.

## 3) Exclusão e cancelamento

- Exclusão física é bloqueada quando:
  - há baixa ativa;
  - `origem_tipo <> 'manual'`.
- Fluxo oficial para encerrar título sem liquidação: `financeiro_cancelar_lancamento`.

## 4) Origem e rastreabilidade

Campos oficiais em `financeiro_lancamentos`:
- `origem_tipo` (`manual`, `fiscal_nota`, `comercial`, `compras`, `parcelamento`, `sistemica`)
- `origem_tabela`
- `origem_id`
- `origem_descricao`

## 5) Conciliação bancária

- Eixo estrutural: **baixa/movimento liquidado** (não vencimento).
- Status de conciliação em `financeiro_baixas.conciliacao_status`:
  - `pendente`, `conciliado`, `divergente`, `desconciliado`.
- View operacional: `vw_conciliacao_eventos_financeiros`.

## 6) Fluxo de caixa previsto x realizado

- `vw_fluxo_caixa_financeiro` unifica:
  - `previsto`: saldos em aberto/parcial (por vencimento);
  - `realizado`: baixas não estornadas (por data de baixa).

## 7) Auditoria mínima

Tabela `financeiro_auditoria` com eventos de:
- criação/alteração/cancelamento de título;
- baixa;
- estorno;
- conciliação/desconciliação.

## 8) Implementação

Migrations aplicadas (2026-04-20):
- CHECK único `chk_financeiro_lancamentos_status` (`aberto/parcial/pago/cancelado`).
- Backfill: 52 títulos `vencido` → `aberto`; quaisquer `estornado` → `cancelado`.
- Função `financeiro_status_efetivo(status, dv, ref)` — `vencido` derivado.
- `financeiro_baixas`: colunas `estornada_em`, `estornada_por`, `motivo_estorno`; índice `idx_fin_baixas_lanc_ativas` (parcial).
- Trigger `trg_sync_financeiro_saldo` reescrito para considerar somente baixas ativas.
- Colunas `origem_tipo`, `origem_tabela`, `origem_id`, `origem_descricao` em `financeiro_lancamentos` (CHECK + backfill por FKs existentes).
- RPC `financeiro_cancelar_lancamento(p_id, p_motivo)` — motivo obrigatório (≥5 chars).
- Trigger `trg_financeiro_protege_delete` — bloqueia DELETE fora de `manual + aberto/cancelado + sem baixas ativas`.
- `financeiro_baixas`: colunas de conciliação (`conciliacao_status`, `conciliacao_data`, `conciliacao_extrato_referencia`, `conciliacao_usuario`).
- RPC `financeiro_conciliar_baixa(p_baixa_id, p_status, p_extrato_referencia)`.
- View `vw_conciliacao_eventos_financeiros` (eixo: baixa).
- View `vw_fluxo_caixa_financeiro` (UNION previsto+realizado).
- Tabela `financeiro_auditoria` + triggers em lançamentos e baixas + RLS (admin/financeiro).
