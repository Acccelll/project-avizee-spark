# MAPA DE ARQUITETURA — CONCILIAÇÃO (AS-IS)

## Camadas

```
┌───────────────────────────── UI (React) ─────────────────────────────┐
│  /conciliacao (Conciliacao.tsx)                                      │
│  /financeiro/matching-aprendizado (MatchingAprendizado.tsx)          │
│  /financeiro/regras (FinanceiroRegrasAliases.tsx)                    │
│                                                                      │
│  Subcomponentes:                                                     │
│   ├─ ConciliacaoTopControls     ─ conta + PeriodFilter + ações       │
│   ├─ OFXMatchingPane            ─ correspondência dual (extrato/lanc)│
│   ├─ VincularBottomSheet        ─ escolha manual (mobile)            │
│   ├─ ConfirmFloatingBar         ─ barra flutuante de confirmação     │
│   └─ DataTable + conciliacaoColumns                                  │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ (props/handlers)
┌─────────────────────────────────▼────────────────────────────────────┐
│  HOOKS DE PÁGINA                                                     │
│   ├─ useConciliacao (867 LoC — orquestrador oficial)                 │
│   └─ useConciliacaoBancaria (React Query — não usado por /conciliacao)│
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────┐
│  SERVICES (src/services/financeiro/**)                               │
│                                                                      │
│  conciliacaoLoaders.service.ts   ─── fetchLancamentosParaConciliacao │
│  conciliacao.service.ts          ─── score + conciliarTransacao      │
│  extratoImportacoes.service.ts   ─── CRUD extrato + status           │
│  criarLancamentoInline.service.ts─── lançamento + baixa em cadeia    │
│  baixaRpc.ts                     ─── fachadas de RPCs (baixa/estorno)│
│  ofxParser.service.ts            ─── parseOFX                        │
│  importacao/importarDocumento    ─── Motor Universal                 │
│  importacao/adapters/{ofx,csv,pdf} ─ adapters de formato             │
│  matching/scoreMatch.ts          ─── fórmula por pesos               │
│  matching/candidatesMatcher      ─── busca top-N                     │
│  matching/rulesEngine            ─── aliases + regras                │
│  matching/scoreExtratoPendentes  ─── persiste sugestão               │
│  matching/detectarTransferencias ─── pares internos                  │
│  matching/feedback.service       ─── aprendizado                     │
│  matching/aprendizadoMetricas    ─── métricas                        │
│  ia/sugestao.service             ─── fetch da Edge Function          │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────┐
│  BIBLIOTECAS AUXILIARES                                              │
│   src/lib/ofx/{canonical,trntype,memoExtractors}                     │
│   src/lib/parseOFX                                                   │
│   src/types/rpc.ts (assinaturas)                                     │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────┐
│  BACKEND (Supabase)                                                  │
│                                                                      │
│  Tabelas:                                                            │
│   contas_bancarias · bancos                                          │
│   financeiro_lancamentos · financeiro_baixas · financeiro_baixa_lotes│
│   financeiro_importacoes_docs · financeiro_extrato_importacoes       │
│   financeiro_aliases · financeiro_regras · financeiro_matching_feedback│
│   conciliacao_bancaria · conciliacao_pares                           │
│   view: vw_conciliacao_eventos_financeiros                           │
│                                                                      │
│  RPCs:                                                               │
│   registrar_baixa_financeira · registrar_baixa_lote_financeira       │
│   estornar_baixa_financeira · financeiro_conciliar_baixa             │
│   financeiro_conciliar_lote · sugerir_conciliacao_bancaria (pg_trgm) │
│   financeiro_processar_estorno · gerar_parcelas_financeiras          │
│                                                                      │
│  Triggers (via pg_proc):                                             │
│   trg_financeiro_auditoria_lanc · trg_financeiro_auditoria_baixa     │
│   trg_financeiro_protege_delete · trg_sync_financeiro_saldo          │
│   trg_lancamento_status_requer_baixa                                 │
│                                                                      │
│  RLS: empresa_id = current_empresa_id() + papéis admin/financeiro    │
│                                                                      │
│  Edge Functions:                                                     │
│   ia-sugestao (Lovable AI Gateway — Gemini flash)                    │
└──────────────────────────────────────────────────────────────────────┘
```

## Padrões arquiteturais

- **Layered service**: UI → hooks → services → RPC/tabela; UI nunca chama `supabase.from` (regra de camada única já registrada em memória).
- **Motor Universal (adapter pattern)**: `importacao/adapters/*` normalizam origens diferentes para `StagedTx`.
- **Estratégia declarativa**: regras + aliases isolados em `rulesEngine.service.ts`; a persistência do resultado é responsabilidade do chamador.
- **RPCs `security definer`** para operações transacionais críticas (baixa, estorno, conciliação em lote).
- **CQRS leve**: leitura de lançamentos usa view/consulta agregada; escrita passa por RPCs; feedback é append-only.
- **Best-effort**: enriquecimento e detecção de transferências são try/catch — falhas não abortam import.

## Comunicação entre módulos

| Origem | Destino | Meio |
|---|---|---|
| Página → hook | mesmo módulo | props + handlers memoizados |
| Hook → services | mesmo processo | import ES direto |
| Services → Postgres | rede | Supabase client (`supabase.from`, `supabase.rpc`) |
| Services → Edge | rede | `fetch` via `@/services/ia/sugestao.service` (fetch dinâmico para split) |
| Backend triggers | Postgres | AFTER INSERT/UPDATE em `financeiro_lancamentos`/`financeiro_baixas` |

## Dependências entre módulos frontend

```
Conciliacao.tsx
   └─ useConciliacao
        ├─ services/financeiro/conciliacaoLoaders
        ├─ services/financeiro/conciliacao.service (score + baixa)
        ├─ services/financeiro/extratoImportacoes.service
        ├─ services/financeiro/criarLancamentoInline
        ├─ services/financeiro/importacao/importarDocumento
        │       ├─ importacao/adapters/{ofx,csv,pdf}
        │       ├─ matching/rulesEngine
        │       ├─ matching/scoreExtratoPendentes
        │       │       └─ matching/candidatesMatcher → matching/scoreMatch
        │       └─ matching/detectarTransferencias
        ├─ services/financeiro/matching/feedback ─(aprender)→ financeiro_aliases
        ├─ services/ia/sugestao (dynamic import)  ─(fetch)→ edge ia-sugestao
        └─ lib/parseOFX + lib/ofx/{canonical, trntype, memoExtractors}
```

## Contratos de fronteira

- **Frontend ↔ RPC**: JSON tipado (Zod inferido em RPCs? — não; apenas tipos TS em `@/types/rpc`).
- **Adapter → linha extrato**: `StagedTx` (id/data/valor/tipo/descricao + enriquecimento canônico opcional).
- **Score → linha extrato**: `{ sugestao_lancamento_id, sugestao_score, sugestao_motivos }` gravado.
- **Feedback → aprendizado**: (acao, extrato_id, sugestao_score, escolha_final) → upsert alias.

## Responsabilidades por camada

| Camada | Responsabilidade | Restrições |
|---|---|---|
| UI | Apresentação, seleção, chamadas de handler | Sem `supabase.from` direto |
| Hook | Estado local + orquestração | Concentra regras de UX (thresholds, confirmações) |
| Services | Chamadas a Supabase, cálculos puros | Sem side-effects fora do banco |
| Matching (puro) | Score e normalização | Zero I/O |
| Adapters | Conversão de formato | Zero I/O |
| Motor Universal | Orquestrar import completo | Best-effort em fases opcionais |
| Backend (RPC/RLS) | Transação + segurança | `security definer` + `search_path=public` |
