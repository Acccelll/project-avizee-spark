# MODELO DE DOMÍNIO — CONCILIAÇÃO (AS-IS)

## Entidades e relacionamentos

```
┌─────────────────────┐   1     N ┌────────────────────────────┐
│  contas_bancarias   │──────────►│ financeiro_lancamentos     │
└──────────┬──────────┘           └──────────┬─────────────────┘
           │ 1                               │ 1
           │                                 │ N
           │                                 ▼
           │  N  ┌────────────────────────────────────────┐
           └───►│ financeiro_baixas                       │
                │ conciliacao_status · conciliacao_extrato_referencia · estornada_em │
                └──────────┬───────────────┬──────────────┘
                           │ N             │ N
                           │               ▼
                           │      ┌──────────────────────────┐
                           │      │ financeiro_baixa_lotes   │
                           │      └──────────────────────────┘
                           ▼
                 ┌────────────────────────────────────┐
                 │ conciliacao_pares                  │
                 │ extrato_id (fitid texto)           │
                 │ lancamento_id                      │
                 │ conciliacao_id ─┐                  │
                 └──────────────┬──┴──────────────────┘
                                ▼
                       ┌────────────────────────┐
                       │ conciliacao_bancaria   │
                       │ (cabeçalho do lote)    │
                       └────────────────────────┘


┌───────────────────────────────┐  1    N ┌────────────────────────────────┐
│ financeiro_importacoes_docs   │────────►│ financeiro_extrato_importacoes │
│ hash SHA-256 · origem · status│         │ conta+fitid · status · sugestao_*│
└───────────────────────────────┘         │ favorecido · forma · natureza  │
                                          │ is_transferencia_interna · par │
                                          └─────────────┬──────────────────┘
                                                        │ 1
                                                        │ N (via feedback)
                                                        ▼
                                        ┌──────────────────────────────────┐
                                        │ financeiro_matching_feedback     │
                                        │ acao · sugestao_score · escolha  │
                                        └──────────────────────────────────┘

┌──────────────────────┐    N ┌───────────────────────┐
│ financeiro_aliases   │◄─────│ (aprendidos via       │
│ desc_normalizada UQ  │      │  registrarFeedback →  │
│ alvo (forn/cli/cc/cc)│      │  aprenderComEscolha)  │
└──────────────────────┘      └───────────────────────┘

┌──────────────────────┐
│ financeiro_regras    │  aplicadas na importação (rulesEngine.aplicarRegrasEAliases)
│ padrao/tipo/quando   │
│ prioridade/ativo     │
│ alvo (forn/cc/cc)    │
└──────────────────────┘
```

## Atores

| Ator | Papel/permissões |
|---|---|
| Usuário `financeiro` | Importa extratos, concilia, cria lançamentos inline, aceita/rejeita sugestões. |
| Usuário `admin` | Todos os acessos + DELETEs em `conciliacao_*` e `financeiro_baixas`. |
| Sistema (Motor Universal) | Enriquece, escora, detecta transferências, aprende aliases. |
| Sistema (RPCs) | Executa baixa/estorno/conciliação em transação (security definer). |
| Edge Function `ia-sugestao` | Sugere par quando heurística falha. |

## Processos (bounded contexts)

1. **Importação** — arquivo → `StagedTx` → `financeiro_extrato_importacoes`.
2. **Enriquecimento / Regras** — hint (alias/regra) + campos canônicos.
3. **Matching** — score persistido + fallback IA sob demanda.
4. **Aprendizado** — feedback → alias.
5. **Conciliação** — baixa + `conciliacao_bancaria`/`pares`.
6. **Estorno / Desfazer** — reabre extrato e estorna baixa.
7. **Detecção de transferências internas** — marca pares espelho.

## Eventos de domínio (implícitos, não pub/sub)

- `ExtratoImportado(documento_id, total, inseridas, com_sugestao)`
- `SugestaoGerada(extrato_id, lancamento_id, score, motivos)`
- `SugestaoAceita/Rejeitada/Corrigida/CriadaInline(extrato_id, ...)`
- `PareamentoConfirmado(conta, pares[])`
- `BaixaRegistrada(baixa_id, lancamento_id)`
- `BaixaConciliada(baixa_id, extrato_ref)`
- `ConciliacaoDesfeita(extrato_id, baixa_id)`
- `TransferenciaInternaDetectada(a, b)`

## Estados (máquina)

**Extrato importação** (`financeiro_extrato_importacoes.status`):
```
pendente ──(aceite/confirmação)──► conciliado
pendente ──(rejeitar / ignorar)──► ignorado
conciliado ──(desfazer)──► pendente
```

**Baixa** (`financeiro_baixas.conciliacao_status` + `estornada_em`):
```
(nova)pendente ──(financeiro_conciliar_baixa)──► conciliado
conciliado    ──(estornar_baixa_financeira)──► estornada_em=NOW, extrato reabre
```

**Lançamento** (`status`):
```
aberto → parcial → pago → (cancelado)
```

## Invariantes

- `financeiro_baixas.uq_baixa_conta_extrato_ref` (parcial: ativa) — 1 baixa ativa por referência de extrato.
- `financeiro_baixas.uniq_baixa_conciliada_por_lanc` — 1 baixa conciliada por lançamento.
- `financeiro_extrato_importacoes.uq_fin_extrato_conta_fitid` — 1 linha por conta/fitid.
- `financeiro_aliases.uq_fin_alias_desc` — 1 alias por empresa/descrição normalizada.
- Reimport de arquivo idêntico proibido por hash em `financeiro_importacoes_docs` (`uq_fid_empresa_arquivo_hash`).
- Trigger `trg_lancamento_status_requer_baixa` garante coerência entre status e existência de baixa.

## Value Objects

- `TransacaoExtrato { id, data, descricao, valor, tipo: C|D }`
- `TransacaoCanonica { …raw, natureza, favorecido*, forma_pagamento, documento }`
- `Match { extratoId, lancamentoId, origem?, sugestaoScore?, motivos?, justificativa? }`
- `MatchScore { score, motivos[] }`
- `RuleHint { fonte: alias|regra|nenhum, ...alvos, motivo }`
