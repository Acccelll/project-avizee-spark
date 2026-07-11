# PLANO MESTRE DE EXECUÇÃO — CONCILIAÇÃO

Documento operacional. Objetivo: executar a arquitetura TO-BE por meio de sprints pequenas, autocontidas, validáveis e reversíveis, prontas para consumo por agente de IA (Lovable/Claude).

## Parte 1 — Estratégia de Execução

**Escolha combinada:**
- **Incremental** — cada sprint entrega valor testável.
- **Modular por domínio** — sprint segue um bounded context (Import, Rules, Matching, etc.).
- **Baseada em feature flags** — `conciliacao_v2.*` por empresa; rollback instantâneo.
- **Releases enxutas** — 1 release = 1 conjunto coeso de sprints com valor de negócio.
- **Branchless em produção** (uma branch principal com flags) — evita divergência longa; alinhado ao workflow Lovable.

Justificativa: minimiza risco financeiro (rollback trivial), maximiza aprendizado (feedback rápido) e mantém coexistência v1/v2 sem branches longas.

## Parte 2 — Releases

| # | Release | Objetivo | Escopo (épicos) | Dependências | Critério de aceite | Riscos |
|---|---|---|---|---|---|---|
| R1 | Fundação | Eliminar riscos P0 | E1 | — | 0 baixa divergente; ledger íntegro; RLS auditada | RPC atômica com bug |
| R2 | Núcleo Arquitetural | Domínio puro + eventos | E2, E8, E10 | R1 | Domínio isolado; outbox 100% | Refatoração amplia superfície |
| R3 | Ingestão | Import + normalização | E3, E4 | R2 | Reimportação idempotente; 0 duplicidades | Adapter OFX regressão |
| R4 | Automação | Regras + Matching + Decisão | E5, E6, E7 | R2, R3 | Benchmark 100k<120s; regras editáveis | NxN explosivo |
| R5 | Baixa Nova | Reconciliation + Posting v2 | E9 | R1, R2, R4 | 0 baixa parcial em falha simulada | RPC longa |
| R6 | UX v2 | Painel de revisão profissional | E11, E17-F1/F4 | R5 | Revisor: 100 itens<5min; piloto ativo | Curva de UI |
| R7 | Governança | RBAC completo + fechamento | E13, E16 | R5, R6 | Reabertura sem trilha=0 | SoD mal parametrizado |
| R8 | Visibilidade | Dashboard + KPIs | E12 | R4, R7 | KPIs P0 disponíveis | Custo de MVs |
| R9 | Escala | Performance + partição + pgmq | E14 | R5, R6 | Metas p95 do TO-BE | Particionamento em prod |
| R10 | Extensibilidade | CNAB/PIX/OF/Multi-moeda | E15 | R3, R4 | Novo adapter≤5 dias-dev | Contrato de terceiros |
| R11 | Migração/Corte | Backfill + descontinuação | E17 | R1..R10 | 100% empresas em v2; 30 dias sem P0 | Dado sujo em corte |

## Parte 3 — Sprints (visão de alto nível)

Cada sprint = 1 unidade Lovable, escopo pequeno, entregável independente. Detalhe em `ROADMAP-DE-SPRINTS.md`.

## Parte 4 — Ordem Ideal

- **Serial obrigatório**: R1 → R2 → R5 → R6 → R11.
- **Paralelo permitido**: R3 e R4 podem correr após R2; R7/R8/R9 após R6; R10 após R3+R4.
- **Bloqueios**: nada de R5+ em produção antes de R1 completo; R11 (descontinuação) só após R7+R8+R9 estáveis por 30 dias.
- **Desbloqueadores-chave**: R1 (fundação), R2 (ports estáveis), R6 (piloto rodando).

## Parte 5 — Plano por Sprint (padrão)

Cada sprint em `ROADMAP-DE-SPRINTS.md` traz: Objetivo · Escopo · Arquivos envolvidos · Dependências · Critérios de aceite · Riscos · Validação · Rollback.

## Parte 6 — Geração de Prompts

Ver `PROMPTS-IMPLEMENTACAO.md`. Um prompt por sprint, autocontido, com contexto, objetivo, arquivos, restrições, regras, critérios, checklist, validação e documentação.

## Parte 7 — Validação após cada sprint

- Rodar suite de testes correspondente (unit/integração/E2E).
- Rodar dataset canônico de regressão financeira.
- Verificar cadeia do ledger.
- Atualizar documentos vivos.
- Verificar KPIs de execução (Parte 17).
- Registrar riscos observados em `RUNBOOKS-CONCILIACAO.md`.

## Parte 8 — Controle de Qualidade

Checklist obrigatório por entrega (idem `CHECKLIST-MESTRE.md`): arquitetura respeitada, sem duplicação, sem regressão, testes verdes, performance preservada, docs atualizadas, logger e ledger operando, RLS+GRANT auditados, feature flag configurada, rollback validado.

## Parte 9 — Rollback

Cada sprint declara:
- Ponto de restauração (commit + flag).
- Passos de rollback (desligar flag; se schema, drop de coluna aditiva).
- Validação pós-rollback (relatório de consistência).
- Nunca apagar dados de ledger/outbox.

## Parte 10 — Dependências Técnicas

Matriz em `MATRIZ-DE-DEPENDENCIAS-EXECUCAO.md`.

## Parte 11 — Paralelização

Autorizada quando: sprints tocam arquivos disjuntos, contratos estão estáveis, testes isoláveis. Exemplos: R3 (Import) e R4 (Rules) após R2; R7/R8/R9 após R6; R10 após R3/R4.

## Parte 12 — Gestão de Riscos

Por sprint em `ROADMAP-DE-SPRINTS.md`. Consolidado em `IMPLEMENTACAO-CONCILIACAO.md` Parte 19.

## Parte 13 — Critérios para Produção

Release pronta quando: 100% testes verdes; benchmarks OK; dataset canônico OK; 0 bug crítico; rollback testado; docs completas; homologação aprovada; runbook publicado; flag configurada.

## Parte 14 — Homologação

Ver `PLANO-DE-HOMOLOGACAO.md`. Três camadas: técnica (SRE), funcional (PO), financeira (controller). Aprovação formal por camada.

## Parte 15 — Implantação

Ordem: staging → piloto (1 empresa) → 3 → 10 → 30 → 100%. Janela em horário não-crítico. Monitoramento intensivo por 7 dias por wave. Contingência: flag off; alerta P0 pausa expansão.

## Parte 16 — Atualização de Documentação

Após cada sprint atualizar (se aplicável): `ARQUITETURA-CONCILIACAO.md`, `ADR-CONCILIACAO.md` (nova ADR quando decisão), `MODELO-CONCEITUAL.md`, `IMPLEMENTACAO-CONCILIACAO.md`, `BACKLOG-CONCILIACAO.md`, `CHECKLIST-IMPLEMENTACAO.md`, `RUNBOOKS-CONCILIACAO.md`, `API-CONTRATOS-CONCILIACAO.md`, `EVENTOS-CONCILIACAO.md`, `REGRAS-CONCILIACAO.md`, `TROUBLESHOOTING.md`, `HISTORICO-EXECUCAO.md`.

## Parte 17 — Métricas de Acompanhamento

- % de sprints concluídas por release.
- Cobertura de testes (core ≥80%, geral ≥60%).
- Bugs encontrados × corrigidos por sprint.
- p95 de importação/matching/baixa.
- Débito técnico (itens abertos por severidade).
- Retrabalho (% de sprints com hotfix).
- Documentos atualizados por sprint.
- Divergências no dataset canônico.

## Parte 18 — Plano de Comunicação

Registro obrigatório em:
- `HISTORICO-EXECUCAO.md` — decisões, desvios, mudanças.
- `ADR-CONCILIACAO.md` — nova ADR para toda decisão arquitetural.
- `CHANGELOG.md` do módulo — releases e sprints.
- Comentários em PR e no ledger de eventos.

## Parte 19 — Checklist Mestre

Ver `CHECKLIST-MESTRE.md`.

## Parte 20 — Preparação para Execução

- **Projeto planejado?** Sim, do AS-IS ao TO-BE, com backlog, roadmap, migração, testes, homologação e prompts prontos.
- **Decisões pendentes?** Nenhuma arquitetural. Detalhes menores (nomes exatos de tabelas/colunas) são resolvidos no primeiro prompt de migração de cada sprint.
- **Riscos não tratados?** Nenhum estrutural. Riscos operacionais listados em `IMPLEMENTACAO-CONCILIACAO.md` Parte 19 e por sprint.
- **Dependências externas?** Apenas Lovable Cloud (Supabase/Postgres) e integrações opcionais (PIX/Open Finance) — todas com adapter isolado.
- **Documentos vivos**: todos listados na Parte 16.
