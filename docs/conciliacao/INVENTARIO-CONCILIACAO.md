# INVENTÁRIO — CONCILIAÇÃO (AS-IS)

## 1. Páginas / rotas

| Rota | Arquivo | Guard |
|---|---|---|
| `/conciliacao` | `src/pages/Conciliacao.tsx` | `PermissionRoute resource="financeiro"` |
| `/financeiro/matching-aprendizado` | `src/pages/financeiro/MatchingAprendizado.tsx` | `PermissionRoute resource="financeiro"` |
| `/financeiro/regras` | `src/pages/financeiro/FinanceiroRegrasAliases.tsx` | `PermissionRoute resource="financeiro"` |

## 2. Componentes específicos

| Arquivo | Papel |
|---|---|
| `src/pages/financeiro/conciliacao/ConciliacaoTopControls.tsx` | Cabeçalho (conta, período, importar, ações). |
| `src/pages/financeiro/conciliacao/OFXMatchingPane.tsx` | Painel de pareamento. |
| `src/pages/financeiro/conciliacao/VincularBottomSheet.tsx` | Bottom sheet mobile. |
| `src/pages/financeiro/conciliacao/ConfirmFloatingBar.tsx` | Barra flutuante de confirmação. |
| `src/pages/financeiro/conciliacao/conciliacaoColumns.tsx` | Colunas de DataTable. |
| `src/pages/financeiro/conciliacao/types.ts` | Tipos locais. |

## 3. Componentes reutilizados

`ModulePage`, `SummaryCard`, `AdvancedFilterBar`, `MultiSelect`,
`EmptyState`, `Tooltip*`, `Sheet*`, `DataTable`, `StatusBadge`,
`PeriodFilter`, `DropdownMenu*`, `Select*`, `Button`, `Badge`, `Card*`,
`Skeleton`, `Input`, `Label`, `Checkbox`, `Switch`, `Table*` — vindos
de `@/components/**` e `@/components/ui/**`.

## 4. Hooks

| Hook | Uso |
|---|---|
| `useConciliacao` (`src/pages/financeiro/conciliacao/useConciliacao.ts`) | Orquestrador oficial de `/conciliacao`. |
| `useConciliacaoBancaria` (`src/pages/financeiro/hooks/useConciliacaoBancaria.ts`) | Alternativo/experimental — não referenciado. |
| `useIsMobile`, `useSearchParams`, `useQuery`, `useMutation`, `useQueryClient` | Auxiliares. |

## 5. Services

Ver §2.2 do AS-IS. Lista:

- `services/financeiro/conciliacao.service.ts`
- `services/financeiro/conciliacaoLoaders.service.ts`
- `services/financeiro/conciliacaoQueries.ts`
- `services/financeiro/extratoImportacoes.service.ts`
- `services/financeiro/ofxParser.service.ts`
- `services/financeiro/baixaRpc.ts`
- `services/financeiro/criarLancamentoInline.service.ts`
- `services/financeiro/importacao/importarDocumento.service.ts`
- `services/financeiro/importacao/types.ts`
- `services/financeiro/importacao/adapters/{ofx,csv,pdf}.ts`
- `services/financeiro/matching/scoreMatch.ts`
- `services/financeiro/matching/candidatesMatcher.service.ts`
- `services/financeiro/matching/rulesEngine.service.ts`
- `services/financeiro/matching/scoreExtratoPendentes.service.ts`
- `services/financeiro/matching/detectarTransferencias.service.ts`
- `services/financeiro/matching/feedback.service.ts`
- `services/financeiro/matching/aprendizadoMetricas.service.ts`
- `services/ia/sugestao.service.ts` (fetch da Edge)
- `services/export.service.ts` (exportação Excel)

## 6. Libs auxiliares

- `src/lib/parseOFX.ts` (parser OFX/QFX bruto).
- `src/lib/ofx/canonical.ts`
- `src/lib/ofx/trntype.ts`
- `src/lib/ofx/memoExtractors.ts`
- `src/lib/importacao/conciliacaoParser.ts` (parser específico de outra
  ingestão — usado por MigracaoDados, não pela tela de conciliação).
- `src/lib/format.ts` (formatCurrency/formatDate).
- `src/lib/logger.ts`.
- `src/lib/financeiro.ts` (`getOrigemKey`/`getOrigemLabel`).

## 7. Tipos

- `src/types/domain.ts`: `Lancamento`.
- `src/types/rpc.ts`: fachadas tipadas de RPCs.
- `src/pages/financeiro/conciliacao/types.ts`: `Match`, `SugestaoPersistida`, `ConciliacaoPersistida`, `LancamentoComStatus`.
- `src/services/financeiro/importacao/types.ts`: `StagedTx`, `OrigemImportacao`, `ImportacaoDocumentoResumo`.
- `src/services/financeiro/matching/feedback.service.ts`: `AcaoFeedback`, `FeedbackMatchingInput`.
- `src/lib/ofx/trntype.ts`: `NaturezaCanonica`.
- `src/lib/ofx/memoExtractors.ts`: `MemoExtracao`.

## 8. Tabelas do banco

`contas_bancarias`, `bancos`, `financeiro_lancamentos`, `financeiro_baixas`,
`financeiro_baixa_lotes`, `financeiro_importacoes_docs`,
`financeiro_extrato_importacoes`, `financeiro_aliases`, `financeiro_regras`,
`financeiro_matching_feedback`, `conciliacao_bancaria`, `conciliacao_pares`,
`financeiro_auditoria`. View: `vw_conciliacao_eventos_financeiros`.

## 9. RPCs

`registrar_baixa_financeira`, `registrar_baixa_lote_financeira`,
`estornar_baixa_financeira`, `financeiro_conciliar_baixa`,
`financeiro_conciliar_lote`, `sugerir_conciliacao_bancaria`,
`financeiro_processar_estorno`, `financeiro_processar_baixa_lote`,
`financeiro_status_efetivo`, `carga_inicial_conciliacao`,
`merge_lote_conciliacao`, `gerar_parcelas_financeiras`,
`gerar_financeiro_folha`, `gerar_financeiro_nfe_saida`, `gerar_financeiro_nfe_entrada`.

## 10. Edge Functions

- `supabase/functions/ia-sugestao/index.ts`
- `supabase/functions/_shared/{cors,logger,rate-limit,sanitize,validate}.ts`

## 11. Integrações externas

- **Lovable AI Gateway** (Gemini 3 Flash Preview).
- **Nenhuma integração direta** com Banco Inter, Mercado Pago, RecargaPay ou Open Finance — apenas regex sobre MEMO.

## 12. Regras de negócio (resumo)

- Thresholds: `AUTO_SCORE_THRESHOLD=0.9`, `SUGESTAO_SCORE_THRESHOLD=0.7`, `SCORE_THRESHOLD_{BAIXA,MEDIA,ALTA}=0.35/0.50/0.70`, `TOLERANCIA_VALOR=0.05`, `JANELA_DIAS=2`.
- Sinal do extrato define crédito/débito → tipo receber/pagar.
- Título `aberto` sem `data_baixa` não é sugerido no matching legado.
- Baixa gerada usa forma `"extrato_conciliacao"`.
- Reimport bloqueado por SHA-256 (arquivo idêntico).
- Duplicidade por linha via `uq_fin_extrato_conta_fitid`.
- Estorno: `estornar_baixa_financeira` (uma baixa por vez); estorno total = `financeiro_processar_estorno` (delega para a primeira, baixa a baixa).
- Estorno é **lógico** (`estornada_em`/`estornada_por`/`motivo_estorno`), não
  físico. Toda consulta a `financeiro_baixas` que represente movimentação
  vigente precisa filtrar `estornada_em IS NULL`. Efeitos colaterais do
  estorno: reverte `contas_bancarias.saldo_atual`, lança contrapartida em
  `caixa_movimentos` (apenas se `caixa_movimento_registrado`), marca a baixa
  como `desconciliado` e reabre a linha de extrato vinculada.

## 13. Configurações & Feature flags

- Nenhuma flag `VITE_FEATURE_*` para o módulo de conciliação (verificado grep negativo).
- Constantes hard-coded nos arquivos do módulo.

## 14. Documentação existente

- `docs/financeiro-motor-importacao-ofx.md`
- Memórias do projeto: `mem://features/conciliacao-bancaria`, `mem://features/edicao-privilegiada-financeiro`, `mem://features/financeiro-migracao-saldos`.

## 15. Testes

- Unit: `scoreMatch.test.ts`, `memoExtractors.test.ts`, `conciliacao.test.ts`.
- Integração: `src/tests/integration/fluxo-financeiro.test.ts`.
- E2E: `e2e/specs/conciliacao-ofx.spec.ts`.
