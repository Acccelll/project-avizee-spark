# CHECKLIST DE MELHORIAS — CONCILIAÇÃO FINANCEIRA

> Consolidação acionável dos GAPs (`CONCILIACAO-GAPS.md`) e da
> matriz (`MATRIZ-PRIORIZACAO-CONCILIACAO.md`). Serve de base para as
> próximas etapas (benchmark, redesenho, implementação).
>
> Marcações: `[ ]` pendente · `[~]` parcial · `[x]` já coberto hoje.
> Todas iniciam `[ ]`. Prioridade em cada item.

---

## 1. Integridade financeira e transacionalidade (P0)

- [ ] **P0** Unificar confirmação em RPC única transacional
      (`registrar_baixa + conciliar + gravar lote`) — cobre A7, J1.
- [ ] **P0** Remover `try/catch` silencioso em `confirmarConciliacao`;
      falhas devem propagar e reverter estado local — A8, E9.
- [ ] **P0** Tornar `conciliacao_bancaria` / `conciliacao_pares`
      obrigatórios; migrar bases antigas — C4.
- [ ] **P0** Bloquear reescrita de `sugestao_*` em linhas com
      `status='conciliado'` (guarda no UPSERT do Motor) — J2.
- [ ] **P0** Substituir fallback "mais recente" por seleção
      determinística de baixa ativa — J3.
- [ ] **P0** Bloquear conciliação em período fechado
      (`fechamentos_mensais`) — J8.
- [ ] **P0** Ao desfazer conciliação, limpar par
      `is_transferencia_interna / transferencia_par_id` — J6.
- [ ] **P0** Exigir motivo/justificativa em diferenças > R$ 0,05 — J10, H2.
- [ ] **P0** Restringir DELETE em `financeiro_extrato_importacoes`
      a role administrativa — H6.
- [ ] **P0** Tratar OFX multi-conta (rejeitar ou distribuir por
      `BANKACCTID`) — B8.
- [ ] **P0** Sincronizar parse local ↔ Motor Universal para eliminar
      race em `handleFileSelect` — B2.

## 2. Performance e escalabilidade (P1)

- [ ] **P1** Atualização incremental de lançamentos após confirmar
      (sem reload total) — D1.
- [ ] **P1** Rodar matching pesado em Web Worker — D3.
- [ ] **P1** Buscar candidatos ERP em lote (evitar N+1) — D4.
- [ ] **P1** Virtualizar `OFXMatchingPane` (react-virtual) — D8.
- [ ] **P1** Índices em `sugestao_lancamento_id`, `status`,
      `data_transacao`, `conta_bancaria_id+data_transacao` — C5.
- [ ] **P1** Detectar transferências com janela indexada, evitando
      O(n²) — D9.
- [ ] **P1** Particionar `financeiro_matching_feedback` por mês — C8.
- [ ] **P1** Cache/parallelização do fallback IA — D5.
- [ ] **P1** Export Excel em worker — D7.
- [ ] **P1** Debounce nos filtros de URL — D10.

## 3. Arquitetura e código (P1/P2)

- [ ] **P1** Decompor `useConciliacao` em hooks temáticos — A1, E1.
- [ ] **P1** Eleger Motor Universal como fonte única; adapter para o
      legado — A2, I2.
- [ ] **P2** Remover `useConciliacaoBancaria` órfão ou promover — A3.
- [ ] **P2** Consolidar `conciliacaoLoaders` + `conciliacaoQueries` — A4.
- [ ] **P2** Camada de repositório para tabelas de conciliação — A5.
- [ ] **P2** Invalidar TanStack Queries relacionadas pós-confirmação — A6.
- [ ] **P2** Mover regra `hideConciliados` para service — A9.
- [ ] **P2** Centralizar tipos em `src/types/domain.ts` — E6, I3.
- [ ] **P2** Padronizar tratamento de erros (nunca engolir) — E5.
- [ ] **P2** Unificar `normalizarDescricao` em util única — E2.
- [ ] **P2** Configurar thresholds por empresa (`app_configuracoes`) — E3.
- [ ] **P2** Naming consistente snake/camel — E4.

## 4. Banco de dados e modelo (P2)

- [ ] **P2** Segregar `financeiro_extrato_importacoes` em
      `..._events` (canônico) e `..._matches` (sugestão/estado) — C1.
- [ ] **P2** FK real de `financeiro_baixas.conciliacao_extrato_referencia`
      para `financeiro_extrato_importacoes(id)` — C3.
- [ ] **P2** Versionar aliases (`valid_from/valid_to`) — C7.
- [ ] **P2** Tabelas de sessão/rascunho de conciliação — B4, C10.
- [ ] **P2** Constraint impedindo conciliar lançamento cancelado — C11.
- [ ] **P3** `empresa_id` explícito na chave `(conta, fitid)` — C2.
- [ ] **P3** Constraint em `prioridade` de `financeiro_regras` — C6.
- [ ] **P3** Investigar visibilidade da view
      `vw_conciliacao_eventos_financeiros` — C9.

## 5. Fluxo de negócio (P1/P2)

- [ ] **P1** UI de matching para CSV/PDF — B1.
- [ ] **P2** Sessão de conciliação persistida (rascunho) — B3, B4.
- [ ] **P2** UI para reabrir sugestões rejeitadas — B6.
- [ ] **P2** Validar período do arquivo vs período selecionado — B9.
- [ ] **P2** Fluxo "extrato como despesa direta" (plano de contas) — B10.
- [ ] **P3** Regras de arredondamento de centavos — B7.

## 6. UX (P1/P2)

- [ ] **P1** Progresso de importação e do Motor Universal — G3, G12.
- [ ] **P2** Redesenho do painel para reduzir carga cognitiva — G1.
- [ ] **P2** Unificar ações auto/valor/lote — G2.
- [ ] **P2** Substituir `window.confirm` por diálogos do DS — B5, G4.
- [ ] **P2** Tela de detalhe do extrato (motivos, decisões) — G5.
- [ ] **P2** Consolidar filtros — G6.
- [ ] **P2** Unificar mobile × desktop — G7.
- [ ] **P2** Bulk actions no painel — G8.
- [ ] **P2** Visão "conciliação do mês" (book-to-bank) — G10.
- [ ] **P3** Aviso antecipado de arquivo já importado (pré-hash) — G11.
- [ ] **P3** Auditoria de acessibilidade — G9.

## 7. Segurança e conformidade (P0/P2)

- [ ] **P0** Restringir DELETE em `financeiro_extrato_importacoes` — H6.
- [ ] **P2** Revalidar `can(...)` em ações críticas do hook — H1.
- [ ] **P2** Motivo/step-up para desfazer — H2.
- [ ] **P2** Registrar autor da conciliação (dependente de A8/C4) — H3.
- [ ] **P2** Mascarar CPF/CNPJ antes de enviar à IA — H8.
- [ ] **P3** Trilha WORM/append-only em `financeiro_auditoria` — H4.
- [ ] **P3** Rate-limit client-side para `ia-sugestao` — H5.
- [ ] **P3** Validação de schema OFX antes de gravar — H7.

## 8. Estado da aplicação (P2)

- [ ] **P2** Fonte única de estado do painel (state machine ou store) — F1.
- [ ] **P2** Substituir `Map` em `useState` por estrutura imutável — F2.
- [ ] **P2** Invalidação global pós-conciliação — F3, A6.
- [ ] **P2** Rollback local quando RPC falha — F4.
- [ ] **P3** Reduzir `staleTime` de contas — F5, D6.

## 9. Qualidade, testes e observabilidade (P1/P2)

- [ ] **P1** Testes de integração para `useConciliacao` e fluxo de
      confirmação — E7, I4.
- [ ] **P2** Ampliar E2E além do caminho feliz (desfazer, IA, race) — E8.
- [ ] **P2** Storybook para componentes específicos — I6.
- [ ] **P2** Docs de conciliação no CI (lint de links, atualização
      obrigatória em PRs de escopo) — I5.
- [ ] **P3** Auditoria final `console.*` → `logger.*` — E10.

## 10. Escalabilidade estrutural (P1/P2)

- [ ] **P1** Plano de particionamento e retenção
      (`financeiro_extrato_importacoes`, `conciliacao_bancaria`,
      `financeiro_matching_feedback`) — C8, escala.
- [ ] **P2** Plugin registry para bancos/adapters (I1).
- [ ] **P2** Feature flags para releases graduais — I7.
- [ ] **P2** Preparar terreno para Open Finance / integrações diretas.

## 11. Funcionalidades ausentes (§12 do GAPs) — P2/P3

- [ ] **P2** Sessão de conciliação persistida com histórico.
- [ ] **P2** Visão book-to-bank e fechamento formal por conta.
- [ ] **P2** Regras compostas (valor + descrição + contraparte + dia).
- [ ] **P2** Sugestão multi-lançamento (split de valor).
- [ ] **P2** Dashboard de saúde (% automático, atraso médio, exceções).
- [ ] **P2** Painel de exceções (pendentes há N dias).
- [ ] **P2** Relatório PDF/CSV de conciliação (auditoria externa).
- [ ] **P2** Aprovação em dois níveis (maker/checker).
- [ ] **P2** Notificações in-app/email de pendências.
- [ ] **P2** Reconciliação PIX/cartão no mesmo fluxo.
- [ ] **P3** ML/embeddings para similaridade.
- [ ] **P3** Integração Open Finance / APIs bancárias diretas.
- [ ] **P3** Undo de rejeição com trilha (complementa B6).
- [ ] **P3** Bulk edit + import/export CSV de aliases/regras.
- [ ] **P3** Simulação "e se aceitar todas ≥ X".
- [ ] **P3** Webhook "conciliação concluída".
- [ ] **P3** Preview do OFX antes de gravar.
- [ ] **P3** Moeda estrangeira / câmbio / IOF.
- [ ] **P3** Suporte offline / retomada após queda de rede.
- [ ] **P3** Drag-and-drop múltiplo + fila de importação.

---

## Uso recomendado

1. Trate itens P0 como pré-requisitos absolutos antes de qualquer
   evolução funcional maior.
2. Use este checklist como entrada para o RFC/redesenho na próxima
   etapa (arquitetura TO-BE).
3. Marque `[~]` quando um item for parcialmente coberto por outro
   trabalho, com referência ao PR/commit correspondente.
