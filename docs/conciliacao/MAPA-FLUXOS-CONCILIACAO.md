# MAPA DE FLUXOS — CONCILIAÇÃO (AS-IS)

## F1. Carregamento inicial da página

```
Router → Conciliacao.tsx
   ├─ useConciliacao()
   │     ├─ useQuery(["contas_bancarias","ativas"]) → listContasBancariasParaConciliacao
   │     └─ useEffect (mount + mudança conta/período) → loadLancamentosFromPeriod
   │            └─ fetchLancamentosParaConciliacao
   │                  ├─ SELECT financeiro_baixas JOIN financeiro_lancamentos
   │                  └─ SELECT financeiro_lancamentos (aberto/parcial)
   │                       → merge por lancamento_id
   └─ render
```

## F2. Importar OFX

```
[input file .ofx] → handleFileSelect
   ├─ parseOFXFile(file) → OFXTransaction[]  (browser)
   ├─ setExtratoItems + setShowOFXPane(true)
   ├─ loadLancamentosFromPeriod(dataInicio=min(datas), dataFim=max, conta)
   └─ importarDocumentoUniversal(file, empresa_id, conta_id)  ← best-effort
         ├─ SHA-256(rawTexto)
         │     ├─ existente? throw "arquivo já importado"
         │     └─ senão continua
         ├─ INSERT financeiro_importacoes_docs (status=processando)
         ├─ carregarRegrasEAliases(empresa_id) → { aliases, regras }
         ├─ mapear StagedTx → row com:
         │     hint = aplicarRegrasEAliases(descricao, tipo, aliases, regras)
         │     score = 0.9 (alias) | 0.7 (regra) | null
         ├─ UPSERT financeiro_extrato_importacoes (onConflict=conta,fitid; ignoreDuplicates)
         ├─ UPDATE docs.status='processado'
         ├─ scoreExtratoPendentes(documento_id) → UPDATE sugestao_* (respeitando feedback)
         └─ detectarTransferenciasInternas(empresa_id) → UPDATE is_transferencia_interna
   └─ loadSugestoesPersistidas(items, conta)
         ├─ listarExtratoPersistido(intervalo)
         ├─ para cada fitid em items:
         │     ├─ status=conciliado → conciliadosPersistidos.set
         │     └─ status=pendente + sugestao_* → sugestoesPersistidas.set
         └─ toast: "N conciliados ocultados" · "M duplicadas"
```

## F3. Importar CSV/PDF

```
handleFileSelect
   ├─ if !selectedConta → toast erro (aborta)
   ├─ importarDocumentoUniversal(file, empresa_id, conta_id)
   │     └─ (mesmas fases do F2, mas parser via adapters csv/pdf)
   └─ loadSugestoesPersistidas([], conta)  ← extratoItems vazio; UI OFX não aparece
```

## F4. Auto-conciliação em lote (score ≥ 0,9)

```
handleConciliacaoAutomatica
   └─ para cada extrato:
         para cada lancamento não usado:
             score = calcularScoreConciliacao(transacao, titulo)
             (60% data + 40% descrição; tolerância R$ 0,01; janela 3d;
              exige data_baixa se status='aberto')
         if melhor score ≥ 0.9 → push Match
   → setMatches (mesclando com manuais existentes)
   → toast(N)
```

## F5. Match por valor + fallback IA

```
handleAutoMatch
   ├─ para cada extrato: busca lançamento (valor ±0.01, data ±3d)
   ├─ pega até 5 sem match e chama sugerirConciliacaoIaRemota (Edge)
   │     └─ Gateway → gemini-3-flash-preview → { lancamento_id, justificativa }
   ├─ push Match origem="heuristica" | "ia"
   └─ setMatches (substitui completos)
```

## F6. Sugestões persistidas

```
Individual:
  handleAceitarSugestao(extratoId)
     ├─ verifica ausência de outro match no lançamento
     ├─ push Match origem="sugestao" com score
     └─ feedback "aceita" (async)

Lote:
  handleAceitarSugestoesPersistidas(minScore=0.7)
     ├─ percorre extratoItems ainda sem match
     ├─ inclui candidatas com score ≥ 0.7 e lancamento livre
     └─ registra feedback "aceita" para cada

Rejeição:
  handleRejeitarSugestao(extratoId)
     ├─ feedback "rejeitada"
     ├─ limparSugestaoExtrato(id) → UPDATE sugestao_*=null
     └─ remove do Map local
```

## F7. Vincular manual

```
Desktop → OFXMatchingPane (Select por linha) → onManualMatch(extratoId, lancamentoId)
Mobile  → VincularBottomSheet → onManualMatch(...)
     ├─ se havia sugestão → feedback "aceita" (bate) ou "corrigida"
     └─ atualiza matches[]

Seleção múltipla (checkbox):
handleConfirmarSelecao(extratoIds[], lancamentoIds[])
   ├─ bloqueia N↔N
   ├─ monta pares 1↔1 / N↔1 / 1↔N
   ├─ feedback para sugestões afetadas
   └─ substitui matches conflitantes
```

## F8. Criar lançamento inline

```
handleCriarLancamentoInline(extratoId)
   ├─ obter empresa_id via user_empresas
   └─ criarLancamentoInlineDoExtrato:
         ├─ carregarRegrasEAliases + aplicarRegrasEAliases (se sem hint manual)
         ├─ INSERT financeiro_lancamentos (status=aberto, saldo=valor)
         └─ registrar_baixa_financeira RPC (forma "extrato_conciliacao")
                 └─ falha ⇒ DELETE lancamento (compensação)
   ├─ se havia sugestão persistida → feedback "criada_inline"
   ├─ push Match origem="inline"
   └─ reload lançamentos
```

## F9. Confirmar lote de conciliação

```
handleConfirmarConciliacao
   ├─ Promise.all(matches.map(par => conciliarTransacao(...)
   │        .then(baixaId => marcarExtratoConciliadoPorFitid({conta, fitid, baixaId}))))
   │
   │   conciliarTransacao:
   │      ├─ SELECT financeiro_lancamentos (saldo, status)
   │      ├─ if status=cancelado → throw
   │      ├─ saldo > 0.009:
   │      │     registrar_baixa_financeira RPC (forma="extrato_conciliacao", valor=saldo)
   │      │     → baixaId
   │      └─ saldo == 0:
   │            SELECT financeiro_baixas ativas
   │            escolhe: (não conciliada && valor exato) →
   │                     (não conciliada && data ±3d)   →
   │                     (mais recente)
   │            → baixaId
   │      └─ financeiro_conciliar_baixa RPC (status=conciliado, extrato_ref=fitid)
   │
   │   marcarExtratoConciliadoPorFitid:
   │      UPDATE financeiro_extrato_importacoes SET status='conciliado', baixa_id, sugestao_*=null
   │
   ├─ confirmarConciliacao (financeiro_conciliar_lote RPC)
   │     ├─ INSERT conciliacao_bancaria (cabeçalho)
   │     └─ INSERT conciliacao_pares[] (transacional)
   │     [try/catch silencioso — tolera ambiente sem RPC]
   │
   ├─ setMatches([]) + remover sugestoesPersistidas confirmadas
   └─ toast "N conciliadas · M sem correspondência"
```

## F10. Desfazer conciliação persistida

```
Usuário clica "Desfazer conciliação" no OFXMatchingPane
   → handleDesfazerConciliacaoPersistida(extratoId)
       ├─ window.confirm
       └─ desfazerConciliacaoExtrato:
             ├─ estornar_baixa_financeira RPC (baixaId, motivo)
             └─ UPDATE financeiro_extrato_importacoes SET status='pendente', baixa_id=null
       └─ reload lançamentos + remove de conciliadosPersistidos
```

## F11. Trilha de aprendizado

```
registrarFeedbackMatching(input)
   ├─ INSERT financeiro_matching_feedback
   └─ se acao ∈ {aceita, corrigida, criada_inline}:
         aprenderComEscolha:
             ├─ SELECT descricao do extrato
             ├─ SELECT fornecedor/cliente/centro/conta do lançamento
             ├─ normalizarDescricao → chave
             └─ UPSERT financeiro_aliases (hits++ ou insert)
```

## F12. Métricas de aprendizado

```
MatchingAprendizado → carregarMetricasMatching({empresa,dataInicio,dataFim})
   └─ SELECT acao, sugestao_score, created_at
         FROM financeiro_matching_feedback
         WHERE empresa_id e período
      → agrega por dia e ação
      → acurácia = aceitas / (aceitas + corrigidas + rejeitadas)
      → scoreMédio
```

## F13. Regras & aliases (admin)

```
FinanceiroRegrasAliases
   ├─ carregar(): SELECT regras/aliases + selects auxiliares
   ├─ criarRegra: validação (nome, padrão, alvo, regex válida) → INSERT financeiro_regras
   ├─ toggleRegra: UPDATE ativo
   ├─ removerRegra/removerAlias: DELETE
```

## F14. Filtros e URL

```
useConciliacao:
   estado ↔ useSearchParams (data_inicio/fim/search/status/tipo) via useEffect replace:true
```

## F15. Ocultar conciliados

```
OFXMatchingPane
   ├─ hideConciliados (state, default true)
   ├─ conciliadosOcultos = contagem via conciliadosPersistidos
   ├─ extratoVisivel = extratoOrdenado.filter(!conciliadosPersistidos.has(id)) se hideConciliados
   └─ badge no header alterna visibilidade
```

## F16. Prevenção de duplicidade

```
Import:
   ├─ hash SHA-256(rawTexto) — bloqueia arquivo idêntico já processado
   └─ UPSERT (conta, fitid) ignoreDuplicates=true — duplicadas contadas em (total - inseridas)
Baixa:
   └─ uq_baixa_conta_extrato_ref (conciliacao_extrato_referencia único por conta, ativa)
```

## F17. Transferências internas

```
detectarTransferenciasInternas(empresa_id, documento_importacao_id?)
   ├─ SELECT linhas pendentes não marcadas
   ├─ separa débitos/créditos
   ├─ para cada débito: procura crédito espelho em outra conta (±0,05, ±2d)
   └─ UPDATE ambos com is_transferencia_interna e transferencia_par_id
```
