# MATRIZ DE PRIORIZAÇÃO — GAPS CONSOLIDADOS

> Tabela única cruzando os GAPs identificados nas etapas anteriores
> (`CONCILIACAO-GAPS.md`, `CONCILIACAO-GAP-TOTVS.md`,
> `REQUISITOS-PROXIMA-GERACAO.md`, `MATRIZ-DE-CAPACIDADES.md`).
> Nenhuma implementação é proposta.
>
> **Legenda**
> - **Impacto**: Baixo · Médio · Alto · Crítico
> - **Complexidade**: XS (< 1d) · S (1-3d) · M (1-2s) · L (2-6s) · XL (> 6s)
> - **Risco de não implementar**: Baixo · Médio · Alto · Crítico
> - **Prioridade**: P0 · P1 · P2 · P3

---

## P0 — Integridade financeira, compliance, perda de dados

| # | GAP | Categoria | Benefício | Impacto | Complexidade | Risco | Dependências |
|---|---|---|---|---|---|---|---|
| G01 | Confirmação transacional atômica (RF-22) | Arquitetura/Financeiro | Elimina estados parciais e baixa órfã | Crítico | M | Crítico | RF-23 |
| G02 | Livro `conciliacao_bancaria` obrigatório (RF-23) | Banco/Auditoria | Prova legal de conciliação | Crítico | S | Crítico | — |
| G03 | Remoção do `try/catch` silencioso em `confirmarConciliacao` | Arquitetura/Observabilidade | Falhas visíveis | Crítico | XS | Crítico | G01 |
| G04 | Bloqueio de período fechado (RF-24) | Governança | Impede mutação retroativa | Crítico | S | Crítico | RF-15 |
| G05 | Motivo obrigatório em desfazer/estornar/rejeitar (RF-25) | Auditoria/Segurança | Compliance | Alto | S | Alto | RF-19 |
| G06 | Deduplicação por fingerprint de transação (RF-02) | Processo | Elimina duplo pagamento | Alto | S | Alto | RF-03 |
| G07 | OFX multi-conta tratado (RF-35) | Captura | Evita mistura de FITIDs | Alto | S | Alto | RF-01/03 |
| G08 | Restrição de DELETE em `financeiro_extrato_importacoes` | Segurança | Reduz perda silenciosa | Alto | XS | Alto | — |
| G09 | Fallback determinístico na escolha da baixa (não "mais recente") | Financeiro | Concilia baixa correta | Alto | S | Alto | G01 |
| G10 | Bloqueio de reescrita de `sugestao_*` em linha já conciliada | Processo | Integridade de estado | Alto | S | Alto | G01 |
| G11 | Ao desfazer, limpar par `is_transferencia_interna` | Financeiro | Estado consistente | Médio | XS | Médio | G01 |
| G12 | Diferenças > tolerância exigem motivo/aprovação (RF-16) | Segurança/Financeiro | Rastreabilidade da divergência | Alto | S | Alto | RF-12 |

---

## P1 — Alto impacto operacional ou arquitetural

| # | GAP | Categoria | Benefício | Impacto | Complexidade | Risco | Dependências |
|---|---|---|---|---|---|---|---|
| G13 | Engine de matching unificada (RF-04) | Arquitetura/Matching | Fim da dupla verdade | Alto | L | Alto | RF-03 |
| G14 | Modelo canônico único (RF-03) | Normalização | Base para tudo | Alto | M | Alto | — |
| G15 | Decomposição do hook `useConciliacao` (867 LoC) | Arquitetura | Manutenibilidade | Alto | L | Médio | — |
| G16 | UI de matching para CSV/PDF/CNAB/API (RF-21) | Processo/UX | Cobertura funcional total | Alto | M | Alto | RF-01/03/04 |
| G17 | Workflow completo com estados discretos (RF-12) | Workflow | SLA, aprovação, fechamento | Alto | L | Alto | RF-14/15/19 |
| G18 | Aprovação em dois níveis (RF-14) | Segurança/Governança | Antifraude e SOX | Alto | M | Alto | RF-12 |
| G19 | Segregação de funções (importar × conciliar × aprovar × auditar) | Segurança | Compliance | Alto | S | Alto | RF-12 |
| G20 | Revalidação `can(...)` em ações críticas do hook | Segurança | Defense in depth | Alto | S | Médio | — |
| G21 | Processamento em fila/worker (parse, score, transferências) | Performance | Desacopla UI | Alto | M | Alto | — |
| G22 | Virtualização de listas grandes (react-virtual) | Performance/UX | Cumpre design system, escala | Alto | S | Alto | — |
| G23 | Paginação server-side + índices críticos | Performance | 10-100× mais rápido | Alto | S | Alto | — |
| G24 | Eliminação de N+1 em `scoreExtratoPendentes` | Performance | Escalabilidade | Alto | M | Alto | RF-04 |
| G25 | Reload incremental pós-confirmação (não recarregar período inteiro) | Performance | UX + carga menor | Médio | S | Médio | — |
| G26 | Testes de integração + E2E do fluxo de confirmação | Qualidade | Base p/ refactor seguro | Alto | M | Alto | G01/G13 |
| G27 | Deduplicação por fingerprint em CSV/PDF (além do OFX) | Processo | Reduz duplicidade | Alto | S | Alto | RF-02/03 |
| G28 | Observabilidade estruturada (logs + tracing + métricas) | Observabilidade | Diagnóstico e SLA | Alto | M | Alto | — |

---

## P2 — Produtividade, UX, manutenção, governança

| # | GAP | Categoria | Benefício | Impacto | Complexidade | Risco | Dependências |
|---|---|---|---|---|---|---|---|
| G29 | Fila de exceções com SLA (RF-13) | Workflow/UX | Backlog visível | Alto | M | Médio | RF-12 |
| G30 | Sessão de conciliação persistida (draft) (RF-19) | Workflow | Retomada e colaboração | Alto | M | Médio | — |
| G31 | Reabertura assistida de sugestões rejeitadas (RF-20) | UX/Workflow | Reduz intervenção SQL | Médio | S | Médio | G30 |
| G32 | Regras versionadas + dry-run (RF-09) | Regras/Governança | Segurança evolutiva | Alto | M | Médio | — |
| G33 | TTL/expiração de aliases (RF-10) | Regras | Aprendizado sadio | Médio | S | Médio | G32 |
| G34 | Recomendação de nova regra (RF-11) | Inteligência | Aumenta automação | Alto | M | Médio | G32 |
| G35 | Score decomposto e explicável (RF-07) | Matching/UX | Confiança e treino | Médio | S | Médio | RF-04 |
| G36 | Thresholds por empresa/conta (RF-08) | Regras | Flexibilidade | Médio | S | Médio | RF-04 |
| G37 | Cardinalidades N×1/1×N com trilha (RF-05) | Matching | Cobertura de agregados | Alto | M | Médio | RF-04 |
| G38 | Detecção de anomalias / duplicidade cruzada (RF-18) | Inteligência/Segurança | Antecipa problemas | Alto | M | Médio | RF-03 |
| G39 | Ajuste contabilizável de divergência (RF-16) | Financeiro | Fluxo sem interrupção | Médio | S | Médio | G17 |
| G40 | Detecção robusta de transferências internas (RF-17) | Matching/Financeiro | Reduz falso ruído | Médio | S | Médio | RF-03 |
| G41 | KPIs operacionais (RF-26) + materialized views | Indicadores | Gestão e melhoria | Alto | M | Médio | RNF-04 |
| G42 | Visão book-to-bank (RF-27) | UX/Governança | Fechamento confiável | Alto | M | Médio | G17/G41 |
| G43 | Timeline por transação (RF-28) | Auditoria/UX | Diagnóstico | Médio | S | Baixo | G30 |
| G44 | Bulk actions com preview (RF-29) | UX | Produtividade | Alto | S | Médio | G17 |
| G45 | Explainable AI ao lado da sugestão (RF-30) | Inteligência/UX | Confiança | Médio | S | Baixo | G35 |
| G46 | Mascaramento de PII em logs e IA (RF-31) | Segurança/LGPD | Compliance | Alto | S | Alto | — |
| G47 | Trilha WORM append-only (RNF-06) | Auditoria | Compliance | Alto | M | Alto | — |
| G48 | Snapshot antes/depois em escrita crítica | Auditoria | Reconstituição | Médio | S | Médio | G47 |
| G49 | Adapter plugável por banco/canal (RF-33) | Arquitetura/Escala | Novo canal sem tocar núcleo | Alto | M | Médio | RF-03 |
| G50 | Event bus downstream (RF-34) | Escala | Ativa contábil/BI | Alto | M | Médio | G01 |
| G51 | Split view extrato ↔ candidatos com breakdown | UX | Reduz erro humano | Alto | M | Médio | G35 |
| G52 | Redesenho do painel (reduzir carga cognitiva) | UX | Adoção | Alto | L | Médio | G51 |
| G53 | Unificar mobile × desktop | UX | Consistência | Médio | M | Baixo | G52 |
| G54 | Substituir `window.confirm` por diálogos do DS | UX | Consistência | Médio | S | Baixo | — |
| G55 | Consolidar filtros duplicados | UX | Consistência | Médio | S | Baixo | — |
| G56 | Materialized views + índices para dashboards | Performance | KPIs constantes | Médio | M | Médio | G41 |
| G57 | Particionamento e política de retenção | Escala | Sustenta volume | Médio | M | Médio | — |
| G58 | Feature flags e releases canário | Manutenção | Reduz risco de release | Médio | S | Médio | — |
| G59 | Centralização de tipos em `src/types/domain.ts` | Qualidade | Contratos claros | Médio | S | Médio | — |
| G60 | Padronização de tratamento de erros | Qualidade | Observabilidade | Médio | S | Médio | G28 |
| G61 | Contratos TS ponta-a-ponta (client/server/DB) | Manutenção | Menos regressão | Médio | M | Médio | G59 |
| G62 | Fluxo "extrato como despesa direta" (RF-16 estendido) | Processo | Cobre casos comuns | Médio | M | Médio | G39 |
| G63 | Validação de período do arquivo × selecionado | Processo | Menos erros silenciosos | Médio | S | Médio | — |
| G64 | Relatório PDF/CSV de conciliação para auditor externo (RF-41) | Governança | Solicitado por auditor | Médio | M | Médio | G42 |
| G65 | Motivo/step-up para desfazer conciliação | Segurança | Auditoria | Alto | S | Alto | G05/G30 |
| G66 | Preview do impacto financeiro em bulk | UX/Segurança | Reduz erros em lote | Alto | S | Médio | G44 |
| G67 | Alertas inteligentes (SLA/extrato faltando) (RF-40) | Inteligência | Reduz atraso | Médio | M | Médio | G29/G50 |

---

## P3 — Refinamentos e evoluções estratégicas de longo prazo

| # | GAP | Categoria | Benefício | Impacto | Complexidade | Risco | Dependências |
|---|---|---|---|---|---|---|---|
| G68 | Matching N×N com split de valor (RF-06) | Matching | Cobre rebateio | Médio | L | Baixo | G37 |
| G69 | Assinatura hash do fechamento (RF-32) | Governança | Prova legal reforçada | Médio | S | Baixo | G04 |
| G70 | Preview do OFX antes de gravar (RF-36) | UX | Prevenção | Baixo | S | Baixo | — |
| G71 | Drag-and-drop múltiplo + fila (RF-37) | UX | Produtividade em lote | Médio | S | Baixo | G21 |
| G72 | Atalhos de teclado (RF-38) | UX | Produtividade | Médio | S | Baixo | G52 |
| G73 | Import/export CSV/JSON de regras/aliases (RF-39) | Regras | Migração/templates | Médio | S | Baixo | G32 |
| G74 | Simulação "aceitar todas ≥ X" (RF-42) | Inteligência/UX | Calibração de threshold | Médio | S | Baixo | G45 |
| G75 | Integração Open Finance BCB | Escala | Substitui OFX manual | Alto | XL | Médio | G49 |
| G76 | APIs bancárias diretas (Itaú/BB/Inter/Sicoob) | Escala | Reduz atrito | Alto | XL | Médio | G49 |
| G77 | CNAB240/CNAB400 | Escala | Cobertura clássica | Alto | L | Médio | G49 |
| G78 | Multi-moeda + câmbio | Escala | Operações externas | Médio | L | Baixo | G14 |
| G79 | Multi-filial com contabilização por filial | Escala | Grupos empresariais | Médio | L | Baixo | G14 |
| G80 | ML/embeddings (pgvector) para similaridade | Matching/IA | Precisão | Médio | L | Baixo | G13/G35 |
| G81 | Isolation Forest / anomalias avançadas | Inteligência | Antifraude | Médio | L | Baixo | G38 |
| G82 | Assistente conversacional sobre conciliação | UX/IA | Diferencial | Baixo | XL | Baixo | G28/G41 |
| G83 | Integração GRC / SOX | Governança | Clientes regulados | Baixo | XL | Baixo | G47 |
| G84 | Webhook "conciliação concluída" | Escala | Integrações downstream | Médio | S | Baixo | G50 |
| G85 | Auditoria de acessibilidade (WCAG AA) | UX/Compliance | Inclusão | Médio | S | Baixo | G52 |

---

## Sequência recomendada (não é plano de implementação)

1. **P0 primeiro** (G01-G12): estabilizar integridade, compliance e
   perda de dados. Sem isto, nenhuma evolução deve avançar.
2. **P1 estrutural** (G13-G28): base arquitetural, performance e
   observabilidade que sustentam todo o resto.
3. **P2 de valor** (G29-G67): workflow completo, UX, governança e
   inteligência.
4. **P3 estratégico** (G68-G85): expansão de canais, ML e integrações
   avançadas.
