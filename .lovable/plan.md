## Problema confirmado

Conferi a planilha `Conciliação_FluxoCaixa_2026-15.xlsx` contra `financeiro_lancamentos`. Há divergências graves vindas da migração de saldos:

### Contas a Receber (aba CR)
- **Planilha:** 97 linhas, total R$ 84.667,03 — **nenhuma com valor zero**.
- **Banco:** 93 lançamentos `tipo=receber`, dos quais **61 estão com `valor = 0,00`, descrição "Lançamento sem descrição", sem conta contábil**.
- Esses 61 zerados são exatamente as parcelas migradas do empréstimo do Elber Kauan e de algumas outras vendas:

| Cliente | Zerados no DB | Linhas reais na planilha |
|---|---|---|
| Elber Kauan Rodrigues Medeiros | 54 | 58 (27 parcelas de "Receita com Empréstimos" R$ 250,00 + 27 de "Receita com Juros") |
| Pluma Genetics | 3 | 7 |
| Nutriza Agroindustrial | 2 | 6 |
| Fredi Soerger | 2 | 2 |

### Contas a Pagar (aba CP)
- **Planilha:** 318 linhas, total R$ 67.074,49.
- **Banco:** 270 lançamentos, total R$ 55.332,91.
- **Faltam ~48 lançamentos e R$ 11.741,58** — provavelmente parcelas de cartão (AliExpress, Inter) também não migradas.

### Causa raiz
A migração inicial de saldos (a tela de Importação → Financeiro) criou os "esqueletos" das parcelas (cliente/fornecedor + vencimento) mas perdeu três campos críticos: `valor`, `descricao` e `conta_contabil_id`. Para o CP houve perda total de algumas parcelas.

## Plano de correção

### 1. Backup e auditoria
- Migration que copia os 61 lançamentos zerados (+ snapshot de CP) para uma tabela `financeiro_lancamentos_backup_20260427` antes de qualquer alteração.

### 2. Reconciliação CR (61 zerados)
- Script de migração que faz match planilha ↔ banco usando `(cliente_id, data_vencimento, conta_contábil)`:
  - Identifica cliente pelo nome canônico (Elber, Pluma, Nutriza, Fredi).
  - Para cada parcela zerada, encontra a linha equivalente na CR pela `data_vencimento` e pelo tipo de receita (Empréstimo R$ 250 ou Juros valor variável).
  - `UPDATE financeiro_lancamentos` setando: `valor`, `saldo_restante = valor - valor_pago`, `descricao` (ex.: "Receita com Empréstimos — Elber Kauan — Parcela X/27"), `conta_contabil_id` (resolvendo via tabela `contas_contabeis` pelo código `6.1.1.01.001` / `6.1.1.01.002`), `forma_pagamento = 'cobranca_automatica'`.
  - Recalcula `status` (aberto/pago/parcial) com base em `data_pagamento` da planilha.

### 3. Reconciliação CP (48 ausentes)
- Cruza planilha CP × DB por `(fornecedor_id, data_vencimento, valor)`.
- Para as 48 linhas ausentes, **INSERT** novos lançamentos `tipo='pagar'` com `origem_tipo='migracao_saldo'`, `descricao`, conta contábil, banco e forma de pagamento da planilha.
- Para qualquer linha CP já no DB com diferença de valor, gera relatório (não altera automaticamente — divergências de centavos podem ser de juros/multa).

### 4. Relatório de conferência
- Após as correções, executar consultas de validação:
  - Soma CR DB == soma CR planilha (R$ 84.667,03)?
  - Soma CP DB == soma CP planilha (R$ 67.074,49)?
  - Zero registros com `valor=0` em `financeiro_lancamentos`.
- Salvar `/mnt/documents/conciliacao_financeira_relatorio.xlsx` listando o que foi corrigido e quaisquer divergências remanescentes para revisão manual.

### 5. UI — exibir avisos
- Já existe a coluna "Saldo em Aberto" mostrando "Quitado" mesmo para R$ 0,00 (imagem anexa). Após a correção, esses lançamentos passarão a refletir os valores reais. Não há mudança de UI necessária.

## Detalhes técnicos

- Todas as alterações em `financeiro_lancamentos` passam por migração SQL versionada (não por edição manual).
- O trigger `trg_sync_financeiro_saldo` recalcula `valor_pago`/`saldo_restante` a partir de `financeiro_baixas`. Para os 61 zerados, **não há baixa associada** — vamos definir manualmente `valor_pago = 0` ou criar baixa caso a planilha indique `Data Pagto` preenchida.
- Para entradas com `Data Pagto` preenchida na planilha, criar registro em `financeiro_baixas` com `valor`, `data_baixa = Data Pagto`, `forma_pagamento = COBRANÇA AUTOMÁTICA` e deixar o trigger recalcular o status.
- `conta_contabil_id` é resolvido por `SELECT id FROM contas_contabeis WHERE codigo = '<código da planilha>'`.
- Trilha de auditoria: cada `UPDATE`/`INSERT` registra `updated_by`/`origem_descricao = 'reconciliacao_planilha_2026-15'`.

## Entregáveis

1. Migration SQL com backup + correções.
2. Migration SQL com inserts dos 48 CP ausentes.
3. Relatório `.xlsx` em `/mnt/documents/` com antes/depois.
4. Validação final mostrando totais batendo com a planilha.
