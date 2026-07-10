# Motor Inteligente de Importação e Conciliação Financeira

Documento consolidado das ondas entregues no épico F —
Financeiro Inteligente 2.0. Cada onda foi implementada de forma
sequencial e é independente/idempotente.

## Onda 1 — Modelo canônico e enriquecimento OFX

- `src/lib/ofx/trntype.ts` — canoniza `TRNTYPE` do OFX em uma
  `NaturezaCanonica` (`pix`, `ted`, `doc`, `boleto`, `cheque`,
  `tarifa`, `cartao`, `debito_automatico`, `outros`).
- `src/lib/ofx/memoExtractors.ts` — heurísticas para extrair
  favorecido, CPF/CNPJ, forma de pagamento, número de documento e
  categoria sugerida a partir de `MEMO`/`NAME`.
- `src/lib/ofx/canonical.ts` — `TransacaoCanonica` desacopla a
  origem (OFX/CSV/PDF) do restante do sistema.
- Testes: `src/lib/ofx/__tests__/memoExtractors.test.ts`.

## Onda 2 — Persistência do lote e header do documento

- Tabela `financeiro_importacoes_docs` — header por arquivo
  importado (origem, hash, período, status, quem importou).
- Novas colunas em `financeiro_extrato_importacoes`:
  `origem`, `documento_importacao_id`, `natureza`, `favorecido`,
  `favorecido_documento`, `forma_pagamento`, `documento`,
  `categoria_sugerida`, `origem_padrao`, `sugestao_score`,
  `sugestao_motivos`.
- Upsert idempotente por `(conta_bancaria_id, fitid)`.

## Onda 3 — Motor de candidatos ERP

- `src/services/financeiro/matching/scoreMatch.ts` — pontuação
  determinística (valor, data, favorecido, documento,
  forma_pagamento) com motivos explicáveis.
- `src/services/financeiro/matching/candidatesMatcher.service.ts`
  — busca em `financeiro_lancamentos` os melhores candidatos por
  linha do extrato.
- Testes em `scoreMatch.test.ts`.

## Onda 4 — Escora pós-import

- `scoreExtratoPendentes.service.ts` — varre as linhas do lote
  recém-importado e grava `sugestao_lancamento_id`,
  `sugestao_score`, `sugestao_motivos` sem sobrescrever
  conciliações confirmadas. Best-effort dentro de
  `importarDocumentoUniversal`.

## Onda 5 — Antiduplicidade e transferências internas

- Índice único parcial `uq_fid_empresa_arquivo_hash` bloqueia
  reimportação do mesmo arquivo pela mesma empresa.
- Colunas `is_transferencia_interna` / `transferencia_par_id` em
  `financeiro_extrato_importacoes`.
- `detectarTransferencias.service.ts` — pareia débito/crédito
  espelhados entre contas próprias (tolerância R$ 0,05 e ±2 dias).

## Onda 6 — Aprendizado contínuo

- `financeiro_aliases` ganhou `hits` + `ultima_confirmacao_em`.
- `feedback.service.ts` — normaliza a descrição do extrato,
  registra o feedback (`aceita`/`rejeitada`/`corrigida`/`criada_inline`) e
  faz upsert em `financeiro_aliases` com o mapeamento aprendido
  (fornecedor, cliente, centro de custo, conta contábil).

## Onda 7 — Importação universal integrada à conciliação

- A tela de conciliação passa a chamar o Motor Universal também para
  OFX, de forma best-effort, mantendo a UI funcional mesmo se a
  persistência inteligente falhar.
- PDF/CSV usam o mesmo orquestrador para gravar o documento, as linhas
  do extrato e os campos enriquecidos.

## Onda 8 — Sugestões persistidas na UI de conciliação

- A UI lê `financeiro_extrato_importacoes` no período do OFX carregado
  e materializa sugestões por `fitid`.
- O usuário pode aceitar uma sugestão individualmente ou aceitar em
  lote as sugestões com score mínimo configurado.
- Matches vindos do motor preservam `origem = 'sugestao'`, score e
  motivos explicáveis para auditoria visual.

## Onda 9 — Feedback humano do matching

- Aceites, rejeições e correções manuais registram eventos em
  `financeiro_matching_feedback`.
- O feedback de aceite/correção alimenta `financeiro_aliases` quando há
  alvo financeiro suficiente para aprendizado.
- Criação inline também retroalimenta o motor quando substitui uma
  sugestão existente.

## Onda 10 — Fechamento do ciclo de sugestão

- Rejeitar sugestão limpa os campos `sugestao_*` da linha de extrato,
  evitando que a mesma sugestão volte imediatamente na UI.
- Confirmar conciliação marca a transação persistida como `conciliado`,
  vincula a baixa quando disponível e remove a sugestão materializada.
- A escora pós-import consulta feedbacks `rejeitada`/`corrigida` e não
  reapresenta candidatos explicitamente bloqueados para o mesmo extrato.

## Como o fluxo se encaixa

```
arquivo → adapter → StagedTx[] → (grava lote + linhas)
  → scoreExtratoPendentes → detectarTransferenciasInternas
  → UI de conciliação → feedback → aprenderComEscolha
  → status do extrato persistido / bloqueio de sugestões rejeitadas
```

Todas as etapas pós-upsert são best-effort: falhas não abortam o
import; apenas reduzem o número de sugestões apresentadas.