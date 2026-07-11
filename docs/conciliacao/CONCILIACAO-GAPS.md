# CONCILIAÇÃO FINANCEIRA — GAPS, RISCOS E OPORTUNIDADES

> Auditoria crítica (somente análise). Não altera código, migrations
> ou arquitetura. Fontes: `CONCILIACAO-AS-IS.md`, código em `main`,
> banco Supabase, edge functions, testes, `mem://features/conciliacao-bancaria`.
> Quando documentação e código divergem, prevalece o código.

Cada item traz: **Categoria · Descrição · Localização · Gravidade
· Impacto · Frequência · Complexidade · Benefício esperado**. A
síntese priorizada está em `MATRIZ-PRIORIZACAO-CONCILIACAO.md`.

---

## 1. Arquitetura

### A1. Hook orquestrador "God object" (867 LoC)
- **Localização**: `src/pages/financeiro/conciliacao/useConciliacao.ts`.
- **Descrição**: concentra estado, IO (Supabase), regra de matching,
  fluxo de importação, feedback, transferências, criação inline,
  desfazer conciliação e sincronização de URL.
- **Gravidade**: Alta · **Impacto**: manutenção, teste, onboarding
  de novos devs · **Frequência**: cada evolução toca este arquivo ·
  **Complexidade**: alta · **Benefício**: decomposição em hooks
  temáticos (`useExtrato`, `useMatching`, `useConfirmacao`,
  `useSugestoesPersistidas`) reduz risco de regressão.

### A2. Duas camadas coexistentes (legado + Motor Universal)
- **Localização**: `conciliacao.service.ts` + `importacao/`.
- **Descrição**: `handleFileSelect` faz parse local **e** dispara o
  Motor Universal em segundo plano. Sugestões, hints e transferências
  ficam em duas fontes de verdade (memória `matches[]` vs tabela
  `financeiro_extrato_importacoes`).
- **Gravidade**: Alta · **Impacto**: divergência silenciosa
  usuário↔banco, dupla escrita, difícil raciocínio · **Complexidade**:
  alta · **Benefício**: eleger o Motor Universal como fonte única.

### A3. Hook alternativo `useConciliacaoBancaria` órfão
- **Localização**: `src/pages/financeiro/hooks/useConciliacaoBancaria.ts` +
  `conciliacaoQueries.ts` + view `vw_conciliacao_eventos_financeiros`.
- **Gravidade**: Média · **Impacto**: código morto, dívida técnica ·
  **Complexidade**: baixa · **Benefício**: remover ou promover.

### A4. Duplicidade parcial entre `conciliacaoLoaders.service.ts` e `conciliacaoQueries.ts`
- Ambos listam lançamentos por caminhos diferentes (baixa+vencimento vs
  view). **Gravidade**: Média · **Benefício**: consolidar em serviço
  único.

### A5. Acoplamento direto a `supabase.from(...)` nos services
- Sem camada de repositório; testes exigem client real. **Gravidade**:
  Média · **Benefício**: interface `ExtratoRepository`/`MatchingRepository`.

### A6. Ausência de invalidação de cache TanStack no fluxo principal
- `useConciliacao` usa `useState`; só `useQuery` para contas e
  métricas. Confirmações não invalidam dashboards financeiros.
  **Gravidade**: Média.

### A7. Ordem de operações não transacional no confirmar
- `handleConfirmarConciliacao` executa baixa → concilia baixa →
  update extrato → RPC lote (em try/catch). Falha após passo 2 deixa
  baixa criada sem cabeçalho de lote e extrato ainda pendente.
  **Gravidade**: Alta · **Benefício**: RPC única transacional ou saga
  com compensação.

### A8. `try/catch` silencioso em `confirmarConciliacao`
- Comentário "Silently fail if tables don't exist yet" mascara erros
  em produção. **Gravidade**: Alta · **Impacto**: cabeçalho de lote
  pode nunca ser gravado, sem alerta.

### A9. Regra de negócio em componente
- `OFXMatchingPane` aplica `hideConciliados` — regra ("conciliados não
  voltam às pendências") vazando para UI. **Gravidade**: Baixa.

---

## 2. Fluxo de Negócio

### B1. Duas rotas de importação divergentes
- OFX abre painel; CSV/PDF só passa pelo Motor Universal sem UI de
  matching. **Gravidade**: Alta.

### B2. Condição de corrida em `handleFileSelect`
- Parse local grava `extratoItems`; Motor grava depois em
  `financeiro_extrato_importacoes`. Se usuário confirmar antes do
  Motor terminar, upsert `(conta,fitid)` pode sobrescrever campos
  canônicos. **Gravidade**: Alta.

### B3. Estado misto memória × persistência
- `matches[]` (memória) vs `sugestoesPersistidas` (Map). Refresh perde
  pareamentos sem aviso. **Gravidade**: Média.

### B4. Sem "sessão de conciliação" (draft)
- Sem entidade agregando pares antes da confirmação; não há retomada
  ou colaboração. **Gravidade**: Média.

### B5. `window.confirm` em decisões críticas
- Desfazer conciliação e diferenças > R$ 0,05. **Gravidade**: Média.

### B6. Rejeitar sugestão bloqueia definitivamente
- Sem UI para reabrir; requer SQL manual. **Gravidade**: Média.

### B7. Sem tratamento de arredondamento de centavos
- `Math.abs(diff) < 0.01` cria falsos divergentes. **Gravidade**: Baixa.

### B8. Sem suporte a OFX multi-conta / multi-moeda
- Parser assume conta selecionada; FITIDs de outra conta podem entrar.
  **Gravidade**: Alta · **Frequência**: bancos digitais.

### B9. Sem validação de período do arquivo vs período selecionado
- Datas são ajustadas silenciosamente. **Gravidade**: Média.

### B10. Sem fluxo "extrato sem título" (despesa direta)
- Só criação inline de lançamento; sem categorizar direto no plano de
  contas. **Gravidade**: Média.

---

## 3. Banco de Dados

### C1. `financeiro_extrato_importacoes` com 27 colunas heterogêneas
- Mistura canônica, hint, estado e flags. **Gravidade**: Média ·
  **Benefício**: separar `..._matches` e `..._events`.

### C2. Chave `(conta_bancaria_id, fitid)` sem `empresa_id` explícito
- Integridade transversal só via `contas_bancarias`. **Gravidade**: Baixa.

### C3. `financeiro_baixas.conciliacao_extrato_referencia` = FITID solto
- Sem FK para `financeiro_extrato_importacoes`. Rollback pode gerar
  órfãos. **Gravidade**: Média.

### C4. `conciliacao_bancaria`/`conciliacao_pares` opcionais
- Fluxo continua funcionando sem cabeçalho, quebrando o "livro".
  **Gravidade**: Alta.

### C5. Ausência de índices em `sugestao_lancamento_id`, `status`, `data_transacao`
- Filtros em memória. **Gravidade**: Média em volumes altos.

### C6. `financeiro_regras.prioridade` sem constraint / normalização
- Prioridades duplicadas dependem de `id`. **Gravidade**: Baixa.

### C7. `financeiro_aliases` sem TTL/versionamento
- Alias errado permanece; só remoção manual. **Gravidade**: Média.

### C8. `financeiro_matching_feedback` sem particionamento
- Full scan em métricas mensais. **Gravidade**: Média em escala.

### C9. View `vw_conciliacao_eventos_financeiros` sem visibilidade
- Não aparece em `information_schema.views`. **Gravidade**: Baixa
  (investigativa).

### C10. Sem tabela de sessões/rascunhos de conciliação
- Impede auditoria de tentativas não concluídas. **Gravidade**: Média.

### C11. Sem constraint impedindo conciliar lançamento cancelado
- Regra apenas no service. **Gravidade**: Média.

---

## 4. Performance

### D1. Reload de período inteiro após confirmação — **Alto**
### D2. `matches[]` em `useState` re-renderiza `DataTable` inteira — **Médio**
### D3. Matching por bigramas em JS síncrono (sem worker) — **Médio/Alto**
### D4. `scoreExtratoPendentes` potencial N+1 (candidatos por linha) — **Alto**
### D5. Fallback IA sequencial até 5 chamadas, sem cache — **Médio**
### D6. `staleTime: Infinity` em contas bancárias — **Baixo**
### D7. Export Excel na thread principal — **Médio**
### D8. Sem virtualização no `OFXMatchingPane` (>100 linhas) — **Alto**
  (viola `mem://tech/performance-virtualizacao`)
### D9. Detecção de transferências O(n²) — **Médio**
### D10. Filtros de URL sem debounce — **Baixo**

---

## 5. Qualidade de Código

- **E1**. Hook único com 867 LoC — legibilidade baixa.
- **E2**. `normalizarDescricao` duplicada (legado × Motor).
- **E3**. Thresholds mágicos espalhados (0,7 / 0,9 / 0,5 / 0,35) —
  deveriam ser configuráveis por empresa.
- **E4**. Naming inconsistente snake/camel entre backend e UI.
- **E5**. Tratamento de erro heterogêneo (throw × logger × silent — A8).
- **E6**. Tipos locais à página, fora de `src/types/domain.ts`.
- **E7**. Testes cobrem apenas parser OFX, score e uma service; hook e
  fluxo de confirmação sem cobertura.
- **E8**. E2E cobre um único caminho feliz.
- **E9**. Comentário "Silently fail" = dívida assumida.
- **E10**. Confirmar que todo `console.*` foi migrado para `logger.*`
  (regra `mem://tech/logging-observabilidade`).

---

## 6. Estado da Aplicação

- **F1**. Mistura `useState` + TanStack + `useSearchParams` sem contrato.
- **F2**. `Map`s em `useState` — armadilha de referência.
- **F3**. Sem `invalidateQueries` para dashboards/DRE/contas a pagar
  após conciliar.
- **F4**. Sem rollback local em memória quando RPC falha (item some do
  painel mesmo em erro).
- **F5**. Cache infinito de contas (D6).
- **F6**. Sem persistência de rascunho (B4).

---

## 7. UX

- **G1**. Painel único vertical, muitos controles simultâneos.
- **G2**. "Auto-conciliar" × "Match por Valor" × "Aceitar sugestões
  (lote)" — thresholds diferentes, propósitos parecidos.
- **G3**. Feedback de importação só por toast (sem progresso).
- **G4**. `window.confirm` foge do design system.
- **G5**. Sem detalhe do extrato (motivos do score, decisões
  anteriores).
- **G6**. Filtros duplicados: `AdvancedFilterBar` + filtros do painel.
- **G7**. Mobile e desktop divergem (`VincularBottomSheet` × pane).
- **G8**. Sem bulk actions (aceitar/rejeitar/ignorar) no painel.
- **G9**. Acessibilidade não verificada (contraste, foco, teclado).
- **G10**. Sem visão "conciliação do mês" (saldo inicial + movimentos +
  saldo final vs banco).
- **G11**. Sem checagem antecipada de arquivo já importado (só toast
  pós-tentativa).
- **G12**. Sem indicador do progresso do Motor Universal em segundo
  plano.

---

## 8. Segurança

- **H1**. `PermissionRoute` protege rota, mas ações críticas no hook
  (desfazer, criar inline) não revalidam `can(...)`.
- **H2**. Desfazer conciliação usa `window.confirm`, sem motivo ou
  step-up.
- **H3**. Sem cabeçalho de lote (A8) → perde autor da conciliação.
- **H4**. Trilha `financeiro_auditoria` mutável por admin.
- **H5**. Sem rate-limit client-side para `ia-sugestao`.
- **H6**. RLS de `financeiro_extrato_importacoes` permite DELETE por
  usuário da empresa — perda silenciosa possível.
- **H7**. Sem validação de schema OFX antes de gravar.
- **H8**. IA recebe descrição bruta (CPF/CNPJ) — sem mascaramento.

---

## 9. Escalabilidade

- **10k lançamentos/mês**: aceitável, UI já pesa (D2/D3/D8).
- **100k**: crítico — matching JS, sem virtualização, view sem índices
  (C5), `useState` gigante.
- **1M+**: inviável no desenho atual. Gargalos:
  - Parser OFX em memória.
  - `scoreExtratoPendentes` sequencial (D4).
  - Transferências O(n²) (D9).
  - Sem particionamento em `financeiro_matching_feedback` (C8) e
    `financeiro_extrato_importacoes`.
  - Sem archive/retention em `conciliacao_bancaria`.

---

## 10. Manutenibilidade

- **I1**. Novo banco = editar `memoExtractors.ts`. Sem plugin registry.
- **I2**. Nova regra = duplicar em legado + Motor.
- **I3**. Sem contrato TS centralizado (E6).
- **I4**. Ausência de testes de integração dificulta refactor.
- **I5**. Documentação fora do CI.
- **I6**. Sem storybook dos componentes específicos.
- **I7**. Sem feature flags para releases controlados.

---

## 11. Riscos Financeiros

- **J1**. Baixa criada sem cabeçalho de lote (A7/A8) — conciliado no
  ERP sem livro para auditoria.
- **J2**. `handleFileSelect` pode reescrever `sugestao_*` sobre linha
  já conciliada em outra sessão (upsert de campos canônicos).
- **J3**. `conciliarTransacao` escolhe "mais recente" como fallback —
  pode conciliar baixa errada quando há várias ativas.
- **J4**. Fallback IA limitado silenciosamente a 5 — pode deixar itens
  sem sugestão sem alerta.
- **J5**. Rejeitar sugestão é irreversível pelo produto.
- **J6**. Desfazer conciliação não desmarca `is_transferencia_interna`
  do par correspondente.
- **J7**. Reimport OFX pode reabrir `sugestao_*` em linhas já corrigidas
  via `criarLancamentoInline`.
- **J8**. Sem controle de "mês fechado" (`fechamentos_mensais`).
- **J9**. Sem verificação de saldo esperado (`caixa_movimentos` /
  `fechamento_financeiro_saldos`) após conciliar.
- **J10**. Diferença > R$ 0,05 aceita com `confirm()`, sem
  justificativa/aprovação.

---

## 12. Funcionalidades ausentes (esperadas em módulo moderno)

1. Sessão de conciliação persistida com histórico e reabertura.
2. Saldo bancário conciliado × contábil (book-to-bank).
3. Fechamento formal por período/conta (assinatura, bloqueio).
4. Integração Open Finance / API bancária direta (Itaú, BB, Inter, Sicoob).
5. Conciliação de fatura de cartão integrada ao mesmo fluxo.
6. Regras compostas (valor + descrição + contraparte + dia).
7. ML/embeddings para similaridade (hoje só Dice + IA pontual).
8. Sugestão multi-lançamento (split automático de valor).
9. UI para reabrir sugestões rejeitadas.
10. Notificações (in-app/email) de extratos pendentes há X dias.
11. Relatório PDF/CSV de conciliação (auditoria externa).
12. Aprovação em dois níveis (maker/checker) acima de valor.
13. Import por drag-and-drop múltiplo + fila.
14. Preview do OFX antes de gravar.
15. Comparativo extrato × caixa/subcontas.
16. Categorização direta em plano de contas para despesa direta.
17. Moeda estrangeira, taxa de câmbio, IOF.
18. Webhook "conciliação concluída" para downstream contábil.
19. Rastreamento explícito quem conciliou/rejeitou/quando.
20. Undo de rejeição com trilha.
21. Bulk edit + import/export CSV de aliases/regras.
22. Simulação: "se aceitar todas ≥ X, o que muda".
23. Dashboard de saúde: % automático, tempo médio, atraso médio.
24. Painel de exceções (linhas sem match há N dias).
25. Detecção de fraudes/anomalias.
26. Reconciliação de PIX/cartão no mesmo fluxo.
27. Configuração de thresholds por empresa.
28. Testes E2E dos principais caminhos e desfazer.
29. Feature flags e canary release.
30. Suporte offline / retomada após queda de rede.

---

## 13. Inconsistências documentação × código

- Threshold auto legado **0,90**; Motor **0,70**; IA **0,50** — sem
  alinhamento explícito.
- `useConciliacaoBancaria` documentado como alternativo mas nunca
  renderizado.
- `financeiro_conciliar_lote` marcado como transacional, mas
  `try/catch` client engole falhas (A8).
- `information_schema.triggers` vazio (C9) — divergência com a
  documentação.

---

## 14. Resumo executivo

O módulo funciona no caminho feliz e traz aprendizado + IA, mas
carrega três riscos estruturais:

1. **Coexistência de duas engines** (legado + Motor Universal) sem
   dono claro, produzindo dupla verdade.
2. **Fluxo de confirmação não atômico** com `try/catch` silencioso,
   permitindo baixas conciliadas sem cabeçalho de lote.
3. **Escala e UX** limitadas: hook God object, sem virtualização, sem
   sessão persistida, sem visão book-to-bank, sem Open Finance.

Priorização em `MATRIZ-PRIORIZACAO-CONCILIACAO.md` e roteiro em
`CHECKLIST-DE-MELHORIAS.md`.
