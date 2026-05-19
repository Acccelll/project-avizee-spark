
# Cobranças Recorrentes — Plano

Objetivo: permitir cadastrar "assinaturas" (Netflix, hospedagem, SaaS, mensalidades a receber etc.) que geram **automaticamente** lançamentos em A Pagar / A Receber a cada ciclo, com vencimento correto inclusive quando pagas via cartão de crédito (segue a fatura do cartão).

## 1. Modelo de dados

Nova tabela `financeiro_recorrencias` (template — não é lançamento):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tipo` | text | `receber` \| `pagar` (chk_) |
| `descricao` | text | "Netflix Premium" |
| `valor` | numeric | valor padrão da parcela |
| `periodicidade` | text | `mensal` \| `bimestral` \| `trimestral` \| `semestral` \| `anual` (chk_) |
| `dia_vencimento` | int | 1–31 (para mensal/anual) |
| `data_inicio` | date | primeiro ciclo |
| `data_fim` | date null | opcional; null = indeterminado |
| `proxima_geracao` | date | controlado pelo job |
| `qtd_ciclos_max` | int null | opcional; encerra após N gerações |
| `ciclos_gerados` | int default 0 | |
| `status` | text | `ativa` \| `pausada` \| `encerrada` \| `cancelada` (chk_) |
| `forma_pagamento` | text | enum canônico (`cartao_credito`, `debito_automatico`, `boleto_dda`…) |
| `cartao_id` | uuid → cartoes_credito | quando cartão |
| `cliente_id` / `fornecedor_id` | uuid | mutuamente exclusivos por `tipo` |
| `conta_bancaria_id`, `conta_contabil_id`, `centro_custo_id` | uuid | herdados nos lançamentos |
| `observacoes`, `ativo`, `created_at`, `updated_at`, `empresa_id` | | padrão |

RLS espelhando `financeiro_lancamentos` (admin-only para delete; financeiro pode CRUD).

Em `financeiro_lancamentos` adicionar `recorrencia_id uuid null` (FK) + `recorrencia_ciclo int null` — para rastrear origem e evitar duplicar.

## 2. Geração automática (RPC + cron)

RPC `gerar_lancamentos_recorrentes()` (`security definer`, `search_path = public`):
- Seleciona recorrências `status='ativa'` com `proxima_geracao <= current_date`.
- Para cada uma:
  - Calcula vencimento base = `proxima_geracao` (ajustado pelo `dia_vencimento`).
  - Se `forma_pagamento='cartao_credito'` + `cartao_id`: resolve fatura via `cartao_fatura_para_data()` e usa o vencimento da fatura (mesma lógica já usada em `useFinanceiroActions`).
  - Insere lançamento em `financeiro_lancamentos` com `recorrencia_id` + `recorrencia_ciclo` (idempotente via unique `(recorrencia_id, recorrencia_ciclo)`).
  - Atualiza `proxima_geracao` += periodicidade; incrementa `ciclos_gerados`.
  - Se atingiu `data_fim` ou `qtd_ciclos_max` → `status='encerrada'`.

Cron diário (pg_cron) chamando a RPC. Sem edge function necessária — tudo no banco.

## 3. UI

### Nova rota `/financeiro/recorrencias`
- Reusa padrões V2: `DataTableV2` + `AdvancedFilterBar` (tipo, status, periodicidade, busca).
- Colunas: Descrição, Tipo (pill), Valor, Periodicidade, Próx. geração, Forma/Cartão, Status (pill via `STATUS_VARIANT_MAP`).
- Ações por linha: Editar, Pausar/Reativar, Encerrar (com motivo), Gerar agora (botão), Ver lançamentos vinculados.

### Drawer/página de cadastro
- Form com itens dinâmicos? Não — formulário simples → **ViewDrawerV2 + FormModal** (regra "Quando Drawer, Quando Página").
- Campos agrupados em `FormSection`:
  - **Identificação**: tipo (receber/pagar), descrição, cliente/fornecedor.
  - **Valor & Ciclo**: valor, periodicidade, dia vencimento, data início, data fim opcional, qtd ciclos opcional.
  - **Pagamento**: forma_pagamento (reusa `FORMA_PAGAMENTO_OPTIONS`); quando `cartao_credito` → select de cartão; hint "Vencimento dos lançamentos seguirá a fatura do cartão".
  - **Contas/Rateio**: conta bancária, conta contábil, centro de custo, observações.

### Integração no Financeiro existente
- Em `/financeiro` (lista de lançamentos): badge "Recorrente" + tooltip linkando ao template quando `recorrencia_id != null`.
- Filtro: "Apenas recorrentes".
- Novo card no topo: "Próximas gerações (7 dias)".

### Sidebar
- Sub-item em "Financeiro" → "Recorrentes" (atrás de `can('financeiro','read')`).

## 4. Edge cases

- **Pausada**: job ignora; ao reativar, `proxima_geracao` salta para o próximo ciclo futuro (não gera retroativos por padrão; toast pergunta se deseja gerar atrasados).
- **Alteração de valor**: aplica só nos próximos ciclos (não toca histórico).
- **Cartão trocado**: novos ciclos resolvem fatura do novo cartão.
- **Dia 31 em meses curtos**: clamp para último dia do mês.
- **Exclusão**: soft via `status='cancelada'`; hard delete só admin e bloqueado se há lançamentos vinculados não estornados.

## 5. Entregáveis (ordem)

1. Migration: tabela `financeiro_recorrencias` + colunas em `financeiro_lancamentos` + RLS + RPC + cron.
2. Service `recorrencias.service.ts` + tipos em `src/types/domain.ts`.
3. Hook `useRecorrencias` (CRUD via `useSupabaseCrud`).
4. Página `/financeiro/recorrencias` + Form + ações (pausar/reativar/encerrar/gerar agora).
5. Badge "Recorrente" + filtro em `/financeiro`.
6. Entrada no sidebar + help entry + memo `mem://features/cobrancas-recorrentes.md`.

## 6. Não-objetivos (fora de escopo)

- Geração a partir de pedidos/contratos do Comercial.
- Cobrança automática via gateway (Stripe/Pagar.me) — apenas registro financeiro.
- Notificação de cobrança ao cliente — pode ser fase 2 reaproveitando `process-email-queue`.
