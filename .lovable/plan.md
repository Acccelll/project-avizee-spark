## Objetivo

Remover o módulo dedicado `/financeiro/recorrencias` (página, rota, serviço, item de menu) e transformar **recorrência em uma opção do bloco de Pagamento da nota fiscal de entrada**. Ao marcar a opção, a nota deixa de gerar parcelas fixas e passa a gerar um **template de cobrança recorrente** que materializa automaticamente os lançamentos financeiros a cada ciclo.

## Remoções (módulo standalone)

- `src/pages/FinanceiroRecorrencias.tsx` — deletar.
- `src/services/recorrencias.service.ts` — deletar.
- `src/routes/financeiro.routes.tsx` — remover rota `/financeiro/recorrencias`.
- `src/lib/navigation.ts` — remover item "Cobranças Recorrentes" do grupo Financeiro.
- `src/types/domain.ts` — remover tipos `FinanceiroRecorrencia*` (manter só o que for usado abaixo).

A tabela `financeiro_recorrencias`, a RPC `gerar_lancamentos_recorrentes()` e o cron job **são mantidos** (já são exatamente a engine que precisamos). Apenas o ponto de criação passa a ser a NFe de entrada.

## Novo fluxo na Entrada de Nota Fiscal

`src/pages/fiscal/components/NfeFormBody.tsx` (seção **Pagamento**):

1. Adicionar checkbox **"Cobrança recorrente"** ao lado de "Movimenta Estoque / Gera Financeiro" (só habilitado quando `gera_financeiro` está ativo).
2. Quando marcado, esconder os campos de **Condição** e **Nº Parcelas** e o `ParcelasFiscalEditor`, e exibir um bloco "Recorrência":
   - Periodicidade: `mensal | bimestral | trimestral | semestral | anual` (default mensal).
   - Dia de vencimento (1–31, default = dia do `data_emissao`; ignorado quando forma=cartão_credito, pois usa a fatura).
   - Data de início (default = `data_emissao`).
   - Encerramento: rádio `Indeterminado | Qtd ciclos | Data fim`.
   - Resumo do "próximo vencimento" calculado (usando `cartao_fatura_para_data` quando cartão).
3. Forma de pagamento aceita as mesmas opções existentes; o campo **Cartão** continua aparecendo para `cartao_credito` e o vencimento dos ciclos sai da fatura.

## Persistência ao salvar a NFe

`src/pages/fiscal/hooks/useFiscalNotaForm.ts` (e/ou serviço de salvamento):

- Se `recorrente = true`:
  - **Não** inserir parcelas em `financeiro_lancamentos` derivadas do `ParcelasFiscalEditor`.
  - Inserir 1 linha em `financeiro_recorrencias` (tipo `pagar`, valor = total da NF, fornecedor = emitente, forma_pagamento/cartao_id replicados, conta_contabil/centro_custo herdados, `origem = 'nfe'`, `origem_id = nfe.id`, `proxima_geracao = data_inicio`, status `ativa`).
  - Disparar a RPC `gerar_lancamentos_recorrentes(p_recorrencia_id := ...)` na sequência para já materializar o primeiro ciclo (em vez de esperar o cron).
- Se `recorrente = false`: comportamento atual (parcelas fixas) — sem alteração.

## Alterações de schema (mínimas)

Migration:

- `ALTER TABLE financeiro_recorrencias ADD COLUMN origem text` (valores: `manual | nfe`) e `origem_id uuid` (FK lógica para `nfe_notas.id`), mais `chk_recorrencia_origem` em (`manual`, `nfe`).
- Índice em `(origem, origem_id)` para auditoria/estorno.
- Ajustar a RPC `gerar_lancamentos_recorrentes` para aceitar parâmetro opcional `p_recorrencia_id uuid` (gerar só aquela quando informado; senão mantém o varredor diário).

## Visualização da recorrência

Sem nova tela. O acesso/auditoria fica:

- Na própria NFe (drawer/visualização): novo bloco "Cobrança recorrente" mostrando status, próximo vencimento, ciclos gerados e botão **Encerrar recorrência** (motivo obrigatório).
- Em `/financeiro`: badge "Recorrente" no lançamento (já existe `recorrencia_id` na linha) e filtro "Origem: recorrência".

## Permissões e regras

- Mesma permissão de criar NFe entrada cria/edita a recorrência atrelada.
- Encerrar recorrência exige `financeiro:update` (igual ao atual).
- Cancelar uma NFe com recorrência ativa: encerrar a recorrência automaticamente e manter os lançamentos já gerados (não estornar histórico).

## Fora de escopo

- Origem a partir de Comercial/Pedido.
- Notificações ao cliente / cobrança automática via gateway.
- Edição em massa de ciclos passados.