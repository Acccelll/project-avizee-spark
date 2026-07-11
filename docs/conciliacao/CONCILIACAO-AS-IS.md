# CONCILIAÇÃO FINANCEIRA — AS-IS

> Documento de engenharia reversa (somente leitura). Descreve o
> funcionamento atual do módulo de Conciliação Bancária do AviZee ERP
> conforme código presente em `main`. Sem sugestões, sem melhorias.

## 1. Visão geral

O módulo permite ao usuário do papel `financeiro`/`admin`:

1. Selecionar uma **conta bancária** e um **período**.
2. **Importar** um extrato (OFX/QFX, CSV ou PDF de fatura de cartão).
3. Ver os **lançamentos ERP** do período (por baixa ativa ou vencimento).
4. **Parear** transações com lançamentos — manual, por heurística, por
   IA (fallback), por sugestão persistida do "Motor Inteligente" ou
   aceitando em lote sugestões acima de um limiar.
5. **Confirmar** o lote: registra baixa financeira (RPC), marca a linha
   de extrato como `conciliado` e grava o cabeçalho + pares em
   `conciliacao_bancaria` / `conciliacao_pares`.
6. **Desfazer** conciliações persistidas (estorna baixa + reabre extrato).
7. Ver métricas de aprendizado em `/financeiro/matching-aprendizado`.
8. Manter regras/aliases em `/financeiro/regras`.

O fluxo apresenta duas camadas coexistentes:

- **Camada legada** (`conciliacao.service.ts` + página `Conciliacao.tsx`
  + hook `useConciliacao.ts`) — em produção. Usa parser OFX local,
  matching com bigramas + RPCs de baixa/lote.
- **Camada "Motor Inteligente" / Motor Universal** (`importacao/`,
  `matching/`, `financeiro_importacoes_docs`, `financeiro_extrato_importacoes`)
  — chamada em paralelo (best-effort) durante o import, escora sugestões,
  aprende aliases e detecta transferências internas.

Ambas convivem: `handleFileSelect` faz parse local + chama o Motor
Universal em segundo plano para persistir e enriquecer os dados.

## 2. Localização (arquivos)

### 2.1 Frontend — Página e composição

| Caminho | Responsabilidade |
|---|---|
| `src/pages/Conciliacao.tsx` | Ponto de entrada (rota `/conciliacao`). Compõe subcomponentes e delega tudo ao hook `useConciliacao`. |
| `src/pages/financeiro/conciliacao/useConciliacao.ts` | Hook orquestrador (867 linhas): estado, queries, uploads, sugestões, matches, confirmação, desfazer, criação inline. Fonte de verdade da tela. |
| `src/pages/financeiro/conciliacao/ConciliacaoTopControls.tsx` | Barra superior: conta, `PeriodFilter`, botão importar, "Conciliar Automaticamente", "Match por Valor" e "Exportar". |
| `src/pages/financeiro/conciliacao/OFXMatchingPane.tsx` | Painel colapsável de correspondência (extrato vs lançamentos); mobile e desktop; checkbox N↔1 / 1↔N; ações aceitar/rejeitar sugestão e desfazer conciliação. |
| `src/pages/financeiro/conciliacao/VincularBottomSheet.tsx` | Bottom sheet mobile para escolha manual de lançamento por extrato. |
| `src/pages/financeiro/conciliacao/ConfirmFloatingBar.tsx` | Barra flutuante com contagem de pares prontos e botão "Confirmar". |
| `src/pages/financeiro/conciliacao/conciliacaoColumns.tsx` | Colunas da `DataTable` de lançamentos. |
| `src/pages/financeiro/conciliacao/types.ts` | `Match`, `SugestaoPersistida`, `ConciliacaoPersistida`, `LancamentoComStatus`. |
| `src/pages/financeiro/MatchingAprendizado.tsx` | Rota `/financeiro/matching-aprendizado` — dashboard de feedbacks. |
| `src/pages/financeiro/FinanceiroRegrasAliases.tsx` | Rota `/financeiro/regras` — CRUD de `financeiro_regras` e listagem/exclusão de `financeiro_aliases`. |
| `src/pages/financeiro/hooks/useConciliacaoBancaria.ts` | Hook alternativo/legado com React Query. Não referenciado pela página `/conciliacao`. |

### 2.2 Services (`src/services/financeiro/`)

| Arquivo | Responsabilidade |
|---|---|
| `conciliacao.service.ts` | Score determinístico (bigramas Dice), `sugerirConciliacao`, `conciliarTransacao` (baixa + `financeiro_conciliar_baixa`), `confirmarConciliacao` (`financeiro_conciliar_lote`), fallback IA. |
| `conciliacaoLoaders.service.ts` | `listContasBancariasParaConciliacao`, `fetchLancamentosParaConciliacao` — carga do eixo híbrido baixa+vencimento. |
| `conciliacaoQueries.ts` | `listLancamentosParaConciliacao` via view `vw_conciliacao_eventos_financeiros`, `sugerirConciliacaoBancariaRpc` (pg_trgm). |
| `extratoImportacoes.service.ts` | CRUD de `financeiro_extrato_importacoes`: persistir, listar, `marcarExtratoConciliadoPorFitid`, `limparSugestaoExtrato`, `ignorarExtrato`, `desfazerConciliacaoExtrato`. |
| `ofxParser.service.ts` | Fachada fina de `@/lib/parseOFX`. |
| `baixaRpc.ts` | Fachadas de RPCs `registrar_baixa_financeira`, `registrar_baixa_lote_financeira`, `estornar_baixa_financeira`, etc. |
| `criarLancamentoInline.service.ts` | Cria `financeiro_lancamentos` + baixa RPC a partir de linha do extrato. |
| `matching/scoreMatch.ts` | Fórmula por pesos (0.40 valor · 0.25 data · 0.25 favorecido · 0.10 forma). |
| `matching/candidatesMatcher.service.ts` | Busca top-N candidatos ERP (janela ±10d). |
| `matching/rulesEngine.service.ts` | Aliases (exato) + Regras (substring/regex, prioridade). |
| `matching/scoreExtratoPendentes.service.ts` | Persiste `sugestao_lancamento_id/score/motivos` em `financeiro_extrato_importacoes`. |
| `matching/detectarTransferencias.service.ts` | Pareia débito↔crédito espelhados entre contas próprias (±0,05/±2d). |
| `matching/feedback.service.ts` | Grava `financeiro_matching_feedback` + `aprenderComEscolha` (upsert `financeiro_aliases`). |
| `matching/aprendizadoMetricas.service.ts` | Agrega KPIs + série diária para o Painel de Aprendizado. |
| `importacao/importarDocumento.service.ts` | Motor Universal: hash → detecta origem → adapter → header docs → upsert linhas → hint → score → transferências. |
| `importacao/types.ts` | `StagedTx`, `OrigemImportacao`, `ImportacaoDocumentoResumo`. |
| `importacao/adapters/{ofx,csv,pdf}.ts` | Adapters de formato. |

### 2.3 Bibliotecas (`src/lib/ofx/`)

| Arquivo | Responsabilidade |
|---|---|
| `canonical.ts` | `TransacaoCanonica` + `fromOFX`. |
| `trntype.ts` | Mapa OFX `TRNTYPE` → `NaturezaCanonica`. |
| `memoExtractors.ts` | Extratores de MEMO por padrão (Inter, Mercado Pago, RecargaPay, PIX, boleto). |
| `../parseOFX.ts` | Parser bruto OFX/QFX. |

### 2.4 Rotas e navegação

- `src/routes/financeiro.routes.tsx`: rotas `/conciliacao`,
  `/financeiro/regras`, `/financeiro/matching-aprendizado` (todas
  dentro de `<PermissionRoute resource="financeiro">`).
- `src/lib/navigation.ts`: item "Aprendizado do matching" na sidebar.

### 2.5 Edge Functions

- `supabase/functions/ia-sugestao/index.ts` — fallback IA
  (`sugerirConciliacaoIaRemota`). Ação `conciliar` devolve
  `{ lancamento_id, justificativa, confianca }` via Lovable AI Gateway
  (`google/gemini-3-flash-preview`).

### 2.6 Testes

- `src/lib/ofx/__tests__/memoExtractors.test.ts`
- `src/services/financeiro/matching/__tests__/scoreMatch.test.ts`
- `src/services/financeiro/__tests__/conciliacao.test.ts`
- `e2e/specs/conciliacao-ofx.spec.ts` — Playwright.

### 2.7 Documentação existente

- `docs/financeiro-motor-importacao-ofx.md` — histórico das ondas do
  Motor Inteligente.
- `mem://features/conciliacao-bancaria`.
- `mem://features/edicao-privilegiada-financeiro`.

## 3. Fluxo funcional (end-to-end)

```
[Usuário]
   │
   │ 1. Seleciona conta + período
   ▼
useConciliacao.handleContaChange / setDataInicio/setDataFim
   │
   │ 2. useEffect ⇒ loadLancamentosFromPeriod
   ▼
fetchLancamentosParaConciliacao
   ├─ financeiro_baixas (data_baixa ∈ período, não estornada)   ── eixo baixa
   └─ financeiro_lancamentos (status aberto/parcial, vencimento) ── eixo vencimento
   │
   │ 3. Importa arquivo (input hidden)
   ▼
handleFileSelect
   ├─ parseOFXFile (browser) → setExtratoItems  ── FEEDBACK IMEDIATO
   ├─ loadLancamentosFromPeriod (datas ajustadas ao arquivo)
   └─ importarDocumentoUniversal (best-effort)
          ├─ detectarOrigem (extensão/mime)
          ├─ SHA-256(rawTexto) ⇒ bloqueio se já importado
          ├─ INSERT financeiro_importacoes_docs (status=processando)
          ├─ carregarRegrasEAliases
          ├─ UPSERT financeiro_extrato_importacoes (conta+fitid) c/ hint (0.9 alias / 0.7 regra) + campos canônicos
          ├─ UPDATE docs.status = 'processado'
          ├─ scoreExtratoPendentes (Fase 2)
          └─ detectarTransferenciasInternas (Fase 3)
          ▼
       loadSugestoesPersistidas
          ├─ listarExtratoPersistido (intervalo do arquivo)
          ├─ para cada fitid presente:
          │     ├─ status=conciliado → conciliadosPersistidos
          │     └─ status=pendente + sugestao_* → sugestoesPersistidas
          └─ toast informa duplicadas e conciliados ocultos
   │
   │ 4. Ações de pareamento (memória em `matches[]`)
   ▼
┌─ handleConciliacaoAutomatica       (score ≥ 0.9 via calcularScoreConciliacao)
├─ handleAutoMatch                   (valor ±0,01 + data ±3d; fallback IA — máx. 5)
├─ handleAceitarSugestao             (aceita 1 sugestão persistida → feedback 'aceita')
├─ handleAceitarSugestoesPersistidas (lote, score ≥ 0.7 → 'aceita')
├─ handleRejeitarSugestao            (limparSugestaoExtrato + 'rejeitada')
├─ handleManualMatch                 (sugestão → 'aceita' se coincide, senão 'corrigida')
├─ handleConfirmarSelecao            (N↔1 / 1↔N via checkbox; N↔N proibido)
├─ handleDesvincularExtrato          (remove do array `matches`)
├─ handleCriarLancamentoInline       (criarLancamentoInlineDoExtrato — feedback 'criada_inline' se substitui sugestão)
└─ handleDesfazerConciliacaoPersistida (linhas já conciliadas)
       └─ confirm() ⇒ desfazerConciliacaoExtrato → estornarBaixa + status=pendente
   │
   │ 5. Confirmação
   ▼
handleConfirmarConciliacao
   ├─ conciliarTransacao(contaId, transacao, lancamentoId) por par:
   │     ├─ carrega lancamento (saldo/status)
   │     ├─ saldo>0 ⇒ registrar_baixa_financeira RPC (forma "extrato_conciliacao")
   │     ├─ senão ⇒ escolhe baixa ativa (valor exato → data ±3d → mais recente)
   │     └─ financeiro_conciliar_baixa RPC (status=conciliado, extrato_ref=fitid)
   ├─ marcarExtratoConciliadoPorFitid (status='conciliado', baixa_id, limpa sugestão)
   ├─ confirmarConciliacao (financeiro_conciliar_lote — cabeçalho + pares atômicos, try/catch)
   ├─ setMatches([]) e remove sugestoesPersistidas confirmadas
```

### 3.1 Caminhos alternativos

- **Extrato CSV/PDF**: `handleFileSelect` chama direto `importarDocumentoUniversal`, exige conta; a UI OFX não aparece.
- **Hook alternativo `useConciliacaoBancaria`**: usa React Query + RPC `sugerir_conciliacao_bancaria` (pg_trgm). Presente no repo, **não** ligado à rota `/conciliacao`.
- **Fallback IA**: só é acionado quando a heurística não cobre; máximo 5 chamadas.

## 4. Fluxo de dados

| Etapa | Origem | Transformação | Destino |
|---|---|---|---|
| Upload | `File` (browser) | `readOFXFileText` / `text()` | string bruta |
| Parse | string | `parseOFXFile` (SGML→JSON) | `OFXTransaction[]` |
| Canonização | `OFXTransaction` | `fromOFX` (trntype + memo extractors) | `TransacaoCanonica` |
| Adapter | canônica | `adaptOFX/adaptCSV/adaptPDF` | `StagedTx[]` |
| Header | metadados | INSERT | `financeiro_importacoes_docs` |
| Linhas | `StagedTx` + hint | UPSERT (`conta,fitid`) | `financeiro_extrato_importacoes` |
| Score | pendentes | `buscarCandidatos` → `scoreMatch` | UPDATE `sugestao_*` |
| Transferência interna | pares espelhados | pareamento | UPDATE `is_transferencia_interna`, `transferencia_par_id` |
| Aprendizado | feedback | INSERT `financeiro_matching_feedback` + upsert `financeiro_aliases` | tabelas de aprendizado |
| Confirmação | pares memoriais | RPCs baixa/conciliação | `financeiro_baixas`, `financeiro_lancamentos`, `conciliacao_bancaria`, `conciliacao_pares` |
| Refresh UI | reload | `loadLancamentosFromPeriod` | novo `lancamentos[]` |

## 5. Arquitetura atual

- **Frontend**: React 18 + Vite + Tailwind + TanStack Query pontual (`useQuery` só para contas e métricas — restante é `useState`).
- **Camada services** (`src/services/financeiro/**`): única porta para o banco (regra `mem://tech/camada-services-unica`). RPCs tipadas em `src/types/rpc.ts`.
- **Backend**: Postgres/Supabase. RLS `empresa_id = current_empresa_id()` + papéis (`admin`, `financeiro`). RPCs `security definer` (`search_path=public`) para operações transacionais.
- **Edge Function `ia-sugestao`**: opcional, fetch direto via Supabase Functions.
- **Estilo**: hook orquestrador único (`useConciliacao`) com subcomponentes puramente apresentacionais.

Módulos consumidos: Financeiro (baixas), Cartões (`syncFaturaStatus`), Fornecedores/Clientes/Centros/Contas contábeis, Contas bancárias, Bancos.

## 6. Banco de dados (entidades)

| Tabela | Papel |
|---|---|
| `contas_bancarias` (12 col) | Contas do usuário. |
| `bancos` (6) | Lookup. |
| `financeiro_lancamentos` (44) | Títulos a pagar/receber. |
| `financeiro_baixas` (22) | Liquidações; inclui `conciliacao_status`, `conciliacao_extrato_referencia`, `estornada_em`. |
| `financeiro_baixa_lotes` (11) | Header de baixas em lote. |
| `financeiro_importacoes_docs` (15) | Header de cada arquivo importado (Motor Universal). |
| `financeiro_extrato_importacoes` (27) | Linhas do extrato — chave única `(conta_bancaria_id, fitid)`. |
| `financeiro_aliases` (12) | Aprendizado `descricao_normalizada` → alvo. |
| `financeiro_regras` (14) | Regras declarativas (substring/regex, prioridade). |
| `financeiro_matching_feedback` (10) | Trilha de aceites/rejeições/correções. |
| `conciliacao_bancaria` (8) | Cabeçalho do lote persistido. |
| `conciliacao_pares` (8) | Pares extrato↔lancamento. |
| `vw_conciliacao_eventos_financeiros` | View consumida pelo hook alternativo. |

Índices críticos: `uq_fin_extrato_conta_fitid`, `uq_fid_empresa_arquivo_hash`, `uq_fin_alias_desc`, `uq_baixa_conta_extrato_ref`, `uniq_baixa_conciliada_por_lanc`.

## 7. Regras de negócio

### 7.1 Matching legado (`calcularScoreConciliacao`)
- Valor obrigatório com tolerância R$ 0,01.
- Título `status='aberto'` sem `data_baixa` não é sugerido.
- Eixo de data = `data_baixa` (se existe) senão `data_vencimento`.
- Δdias > 3 → score 0.
- Pesos: 60% data + 40% descrição (Dice sobre bigramas normalizados — sem acentos, sem números ≥ 5 dígitos, sem pontuação).
- Thresholds: baixa 0,35 · média 0,50 · alta 0,70.
- Auto-conciliação em lote: score ≥ **0,90**.

### 7.2 Matching Motor Inteligente (`scoreMatch`)
- Sinal do extrato deve casar com tipo (crédito↔receber, débito↔pagar).
- Pesos: valor 0.40 · data 0.25 · favorecido 0.25 · forma 0.10.
- Documento (CPF/CNPJ) bate → favorecido cheio; nome via Jaccard (≥ 0,6).
- Data ≤ 3d = 1; decai linear até 10d; > 10d = 0.
- Valor: diff ≤ 0,05 → 1; ≤ 1 → 0,6; ≤ 5 → 0,3.
- `minScore` padrão = 0,60; UI aceita lote com score ≥ 0,70.

### 7.3 Regras + aliases
- Precedência: **alias exato** > **regras** (maior `prioridade`).
- Regras filtradas por `ativo=true` e `quando_tipo ∈ {debito|credito|ambos}`.
- Normalização unificada em `normalizarDescricao`.
- `criarLancamentoInline` aplica o hint quando não há fornecedor/centro/conta informado.

### 7.4 Feedback e aprendizado
- Ações: `aceita | rejeitada | corrigida | criada_inline`.
- `rejeitada` limpa `sugestao_*` da linha e bloqueia o mesmo par em `scoreExtratoPendentes`.
- Confirmações disparam `aprenderComEscolha` (upsert `financeiro_aliases`; respeita `chk_fin_alias_alvo`).

### 7.5 Baixa e conciliação
- `conciliarTransacao` cria baixa via RPC quando `saldo_restante > 0`; senão localiza baixa ativa (valor exato → data ±3d → mais recente).
- `conciliacao_extrato_referencia = fitid`; `uq_baixa_conta_extrato_ref` impede reuso.
- Baixa conciliada única por lançamento (`uniq_baixa_conciliada_por_lanc`).
- Lançamento `cancelado` não pode ser conciliado.
- Desfazer: `estornar_baixa_financeira` + status extrato=pendente.

### 7.6 Duplicidade e transferências
- Reimport bloqueado por SHA-256 do texto do arquivo por empresa.
- Upsert com `ignoreDuplicates=true` e chave `(conta, fitid)` impede repetições.
- Toast informa `duplicadas = total - inseridas`.
- Transferências internas: valores opostos (±0,05), contas próprias, ±2 dias.

### 7.7 Estados
- `financeiro_extrato_importacoes.status`: `pendente | conciliado | ignorado`.
- `financeiro_importacoes_docs.status`: `processando | processado`.
- `financeiro_baixas.conciliacao_status`: `pendente | conciliado`.
- Lançamento: `aberto | parcial | pago | cancelado`.
- UI: `pendente | conciliado | divergente` (`|diff|<0,01` conciliado).

### 7.8 Seleção múltipla
- 1↔1, N↔1 e 1↔N permitidos. N↔N bloqueado.
- Diferença > R$ 0,05 exige `window.confirm`.

## 8. APIs / RPCs / Edge Functions

### 8.1 RPCs Postgres consumidas
| RPC | Chamada de | Propósito |
|---|---|---|
| `registrar_baixa_financeira` | `conciliarTransacao`, `criarLancamentoInline`, `baixaRpc.ts` | Cria baixa. |
| `registrar_baixa_lote_financeira` | `baixaRpc.ts` | Baixa em lote. |
| `estornar_baixa_financeira` | `desfazerConciliacaoExtrato` via `baixaRpc.ts` | Estorna baixa. |
| `financeiro_conciliar_baixa` | `conciliarTransacao` | Marca baixa como conciliada. |
| `financeiro_conciliar_lote` | `confirmarConciliacao` | Cabeçalho + pares transacional. |
| `financeiro_processar_estorno` | Estornos gerais. |
| `sugerir_conciliacao_bancaria` | Hook alternativo | Ranking pg_trgm. |
| Vizinhas: `gerar_parcelas_financeiras`, `gerar_financeiro_folha`, `carga_inicial_conciliacao`, `merge_lote_conciliacao`, `financeiro_status_efetivo`. |

### 8.2 Edge Functions
- `ia-sugestao` — ações `categorizar | conciliar | explicar_anomalia`. Modelo `google/gemini-3-flash-preview` via Lovable Gateway. CORS + rate-limit em `_shared/`.

### 8.3 Autenticação/Autorização
- `<PermissionRoute resource="financeiro">`.
- `supabase.auth.getUser()` + `user_empresas` para descobrir `empresa_id`.
- RLS `empresa_id = current_empresa_id()`; escrita restrita a `admin`/`financeiro`.

## 9. Estados da aplicação

- **TanStack Query**: contas (`["contas_bancarias","ativas"]`, staleTime infinito) e métricas de aprendizado (`60_000`ms).
- **useState** em `useConciliacao`: `selectedConta`, `extratoItems`, `lancamentos`, `matches`, `sugestoesPersistidas` (Map), `conciliadosPersistidos` (Map), `uploading`, `confirming`, `loadingLanc`, filtros, `vincular*`.
- **URL search params**: `data_inicio/fim/search/status/tipo` sincronizados via `useSearchParams`.
- Sem Redux/Zustand/Context dedicado.

## 10. Telas

### 10.1 `/conciliacao`
- Barra superior, cards resumo, onboarding, `AdvancedFilterBar`+`MultiSelect`, `DataTable`, `OFXMatchingPane` (colapsável), `ConfirmFloatingBar` fixo, `VincularBottomSheet` mobile.

### 10.2 `/financeiro/matching-aprendizado`
- Filtro de datas, 4 KPIs (Aceitas, Corrigidas, Rejeitadas, Criadas inline), 2 KPIs derivados (Acurácia, Score médio), gráfico `BarChart` empilhado.

### 10.3 `/financeiro/regras`
- Abas Regras (CRUD) e Aliases (leitura + remoção).

## 11. Componentes

- Reutilizados: `ModulePage`, `SummaryCard`, `AdvancedFilterBar`, `MultiSelect`, `EmptyState`, `Tooltip`, `Sheet`, `DataTable`, `StatusBadge`, `PeriodFilter`.
- Específicos: `ConciliacaoTopControls`, `OFXMatchingPane`, `VincularBottomSheet`, `ConfirmFloatingBar`, `conciliacaoColumns`.

## 12. Hooks

- `useConciliacao` — orquestrador principal (867 LoC).
- `useConciliacaoBancaria` — alternativo/experimental (não referenciado por `/conciliacao`).
- `useIsMobile`, `useSearchParams`, `useQuery`, `useState`, `useCallback`, `useMemo`.

## 13. Services

Ver §2.2. Todos importam `supabase` direto ou RPCs tipadas de `@/types/rpc`. Sem `fetch` direto (exceto `sugestao.service.ts` para IA).

## 14. Permissões

- Rotas com `PermissionRoute resource="financeiro"`.
- Backend RLS:
  - `financeiro_extrato_importacoes`: RLS simples por `empresa_id` (SELECT/INSERT/UPDATE/DELETE).
  - `financeiro_importacoes_docs`, `financeiro_aliases`, `financeiro_regras`, `financeiro_matching_feedback`: SELECT por empresa; WRITE `admin`|`financeiro`.
  - `conciliacao_bancaria`/`conciliacao_pares`: WRITE `admin`|`financeiro`; DELETE só `admin`.
  - `financeiro_baixas`: WRITE `admin`|`financeiro`; DELETE só `admin`.
- RPCs `security definer` com verificação interna.

## 15. Eventos

- Sem EventEmitter/observer.
- `useEffect` reage a mudanças de conta/período.
- `useSearchParams({replace:true})` sincroniza URL.
- `queryClient.invalidateQueries` no hook alternativo.

## 16. Logs / auditoria

- `logger.warn/error` (`src/lib/logger.ts`); `console.*` proibido.
- Triggers server-side (via `pg_proc`): `trg_financeiro_auditoria_lanc`, `trg_financeiro_auditoria_baixa`, `trg_financeiro_protege_delete`, `trg_lancamento_status_requer_baixa`, `trg_sync_financeiro_saldo`, `trg_init_financeiro_saldo`.
- Tabela `financeiro_auditoria`.
- `financeiro_matching_feedback` também é trilha de aprendizado.
- Notificações UI: `sonner`.

## 17. Configurações e constantes

- `AUTO_SCORE_THRESHOLD = 0.9`
- `SUGESTAO_SCORE_THRESHOLD = 0.7`
- `SCORE_THRESHOLD_BAIXA/MEDIA/ALTA = 0.35 / 0.50 / 0.70`
- `TOLERANCIA_VALOR = 0.05` (`scoreMatch`)
- `JANELA_DIAS = 2`, `TOLERANCIA = 0.05` (transferências)
- `minScore = 0.6` (`scoreExtratoPendentes`)
- Extensões aceitas: `.ofx | .qfx | .xml | .pdf | .csv`
- Forma da baixa gerada: `"extrato_conciliacao"`

## 18. Dependências externas

- **Lovable AI Gateway** (via `ia-sugestao`) — Gemini flash.
- **Supabase** (Postgres, Auth, Functions).
- `@tanstack/react-query`, `sonner`, `recharts`, `lucide-react`, `react-router-dom`, `zod`.
- Parser OFX próprio (`src/lib/parseOFX`).
- Sem integração direta com bancos ou Open Finance; extração de padrões acontece apenas nos regex de `memoExtractors.ts` (Inter, Mercado Pago, RecargaPay, PIX, boleto).

## 19. Casos de uso

1. Importar extrato OFX.
2. Reimportar OFX sobreposto (idempotente).
3. Reimportar arquivo idêntico (bloqueio por hash).
4. Importar CSV/PDF (Motor Universal, sem UI OFX).
5. Filtrar lançamentos.
6. Ampliar período (+30 dias) quando vazio.
7. Auto-conciliar (≥ 0,9).
8. Match por valor + IA fallback.
9. Aceitar sugestão (individual ou lote ≥ 0,7).
10. Rejeitar sugestão (bloqueia futuras).
11. Vincular manual (bottom sheet mobile ou pane desktop).
12. Confirmação com seleção múltipla (N↔1 / 1↔N).
13. Criar lançamento inline a partir do extrato.
14. Confirmar lote → grava baixa/conciliação.
15. Desfazer conciliação persistida (estorna).
16. Exportar planilha Excel.
17. Consultar Painel de Aprendizado.
18. Gerenciar regras/aliases.

## 20. Inventário
Ver `INVENTARIO-CONCILIACAO.md`.

## Dúvidas / inconsistências

1. **Duplicidade de hooks**: `useConciliacao` (usado) vs `useConciliacaoBancaria` (não referenciado). Hipótese: hook experimental/legado ainda em `main`.
2. **View `vw_conciliacao_eventos_financeiros`**: consumida pelo hook alternativo mas não retornada por `information_schema.views` no ambiente Cloud atual. Hipótese: view existente com dono/schema restrito à visão do usuário.
3. **Triggers**: `information_schema.triggers` retornou vazio; funções `trg_*` existem. Hipótese: triggers vinculados a tabelas não listadas ou permissões restringem o `information_schema`.
4. **`confirmarConciliacao`** tem `try/catch` silencioso com comentário "Silently fail if tables don't exist yet" — comportamento tolerante a bases legadas.
5. **Thresholds divergentes**: 0,7 (Motor Inteligente), 0,9 (auto legado) e 0,5 (fallback IA) coexistem.
6. **Fallback IA** consome no máximo 5 chamadas por execução — extratos pendentes acima disso não recebem sugestão.
7. **Persistência do lote `conciliacao_bancaria`**: só ocorre se `financeiro_conciliar_lote` existir; em ambientes antigos o cabeçalho pode não ser escrito.
