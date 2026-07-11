# MATRIZ DE DEPENDÊNCIAS — CONCILIAÇÃO (AS-IS)

## 1. Frontend → Services

| Frontend | Service consumido |
|---|---|
| `Conciliacao.tsx` | `useConciliacao` |
| `useConciliacao` | `conciliacao.service`, `conciliacaoLoaders.service`, `extratoImportacoes.service`, `criarLancamentoInline.service`, `importacao/importarDocumento.service`, `matching/feedback.service`, `ia/sugestao.service` (dynamic), `lib/parseOFX` |
| `MatchingAprendizado.tsx` | `matching/aprendizadoMetricas.service`, `supabase.auth`, `user_empresas` |
| `FinanceiroRegrasAliases.tsx` | acessos diretos `financeiro_regras`, `financeiro_aliases`, `fornecedores`, `centros_custo`, `contas_contabeis` |
| `OFXMatchingPane.tsx` | tipos locais + libs de format |
| `VincularBottomSheet.tsx` | tipos + format |
| `ConfirmFloatingBar.tsx` | tipos |
| `conciliacaoColumns.tsx` | `StatusBadge`, `lib/financeiro`, `lib/format` |

## 2. Services → Backend

| Service | Tabela / RPC / Edge |
|---|---|
| `conciliacaoLoaders.service` | `contas_bancarias`, `bancos`, `financeiro_baixas`, `financeiro_lancamentos` |
| `conciliacaoQueries` | view `vw_conciliacao_eventos_financeiros`, RPC `sugerir_conciliacao_bancaria` |
| `conciliacao.service` | `financeiro_lancamentos`, `financeiro_baixas` (SELECT), RPCs `registrar_baixa_financeira`, `financeiro_conciliar_baixa`, `financeiro_conciliar_lote`, Edge `ia-sugestao` |
| `extratoImportacoes.service` | `financeiro_extrato_importacoes` (todos verbos) |
| `baixaRpc.ts` | RPCs baixa/estorno/geração |
| `criarLancamentoInline.service` | INSERT `financeiro_lancamentos` + RPC `registrar_baixa_financeira`; consulta rulesEngine |
| `importacao/importarDocumento` | `financeiro_importacoes_docs`, `financeiro_extrato_importacoes`, chamadas a `rulesEngine`, `scoreExtratoPendentes`, `detectarTransferencias` |
| `matching/candidatesMatcher` | `financeiro_lancamentos` (janela ±10d), score puro |
| `matching/rulesEngine` | `financeiro_aliases`, `financeiro_regras` |
| `matching/scoreExtratoPendentes` | `financeiro_extrato_importacoes`, `financeiro_matching_feedback` |
| `matching/detectarTransferencias` | `financeiro_extrato_importacoes` |
| `matching/feedback.service` | `financeiro_matching_feedback`, `financeiro_extrato_importacoes`, `financeiro_lancamentos`, `financeiro_aliases` |
| `matching/aprendizadoMetricas` | `financeiro_matching_feedback` |
| `ia/sugestao.service` | Edge `ia-sugestao` |

## 3. Tabelas e RPCs — quem escreve

| Tabela | Escrito por |
|---|---|
| `financeiro_extrato_importacoes` | `extratoImportacoes.service`, `importacao/importarDocumento`, `scoreExtratoPendentes`, `detectarTransferencias` |
| `financeiro_importacoes_docs` | `importacao/importarDocumento` |
| `financeiro_aliases` | `rulesEngine.confirmarAlias`, `feedback.aprenderComEscolha`, `FinanceiroRegrasAliases` (DELETE) |
| `financeiro_regras` | `FinanceiroRegrasAliases` |
| `financeiro_matching_feedback` | `feedback.registrarFeedbackMatching` |
| `financeiro_lancamentos` | `criarLancamentoInline`, RPCs |
| `financeiro_baixas` | apenas RPCs (`registrar_baixa_financeira`, `estornar_baixa_financeira`, `financeiro_conciliar_baixa`) |
| `conciliacao_bancaria` / `conciliacao_pares` | RPC `financeiro_conciliar_lote` |

## 4. Dependências entre services

```
importarDocumento
  ├─ adapters/{ofx,csv,pdf}
  ├─ rulesEngine.carregarRegrasEAliases
  ├─ rulesEngine.aplicarRegrasEAliases
  ├─ scoreExtratoPendentes
  │      └─ candidatesMatcher → scoreMatch
  └─ detectarTransferencias

feedback.registrarFeedbackMatching
  └─ aprenderComEscolha → financeiro_aliases

conciliacao.service.conciliarTransacao
  ├─ registrarBaixaFinanceiraRpc
  └─ financeiroConciliarBaixaRpc

conciliacao.service.confirmarConciliacao
  └─ financeiroConciliarLoteRpc

criarLancamentoInlineDoExtrato
  ├─ rulesEngine
  └─ registrarBaixaFinanceiraRpc
```

## 5. Integrações externas

| Integração | Ponto | Usa |
|---|---|---|
| Lovable AI Gateway | Edge `ia-sugestao` | fallback matching |
| — | — | (nenhuma outra externa) |

## 6. Módulos vizinhos consumidos

- **Cartões**: `cartoesCredito.service.syncFaturaStatus` chamado por `baixaRpc.posProcessarBaixaCartao`.
- **Auditoria**: `financeiro_auditoria` + triggers `trg_financeiro_auditoria_*`.
- **Permissões**: `has_role`, `current_empresa_id`.
- **Cadastros**: `fornecedores`, `clientes`, `centros_custo`, `contas_contabeis`, `contas_bancarias`, `bancos`.
- **NF-e / Recebimentos**: gera lançamentos consumidos aqui (`origem_tipo`, `documento_pai_id`).

## 7. Rotas → recursos protegidos

| Rota | Permissão |
|---|---|
| `/conciliacao` | `financeiro:view` (`PermissionRoute`) |
| `/financeiro/regras` | `financeiro:view` |
| `/financeiro/matching-aprendizado` | `financeiro:view` |
| RPCs escrita | `admin` ou `financeiro` |
| DELETE conciliacao/baixas | `admin` |

## 8. Estados / caches invalidados

| Ação | Invalidations |
|---|---|
| Import OFX | `loadLancamentosFromPeriod` (manual), best-effort não invalida react-query da tela oficial (hook não usa) |
| Aceitar sugestão | apenas estado local `matches` + toast |
| Confirmar conciliação | reload manual de lançamentos (hook oficial); no hook alternativo: `queryClient.invalidateQueries(["conciliacao-*", "financeiro", "contas_bancarias"])` |
| Desfazer | reload manual de lançamentos |
| Feedback | não invalida — leituras próximas veem sugestão limpa via `limparSugestaoExtrato` |
