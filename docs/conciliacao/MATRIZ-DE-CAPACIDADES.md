# MATRIZ DE CAPACIDADES — CONCILIAÇÃO FINANCEIRA

> Capacidades identificadas no benchmark (`CONCILIACAO-BENCHMARK.md`,
> `COMPARATIVO-ERP.md`) classificadas por relevância para o AviZee.
> Não propõe implementação.
>
> **Classes**
> - **Essencial** — sem ela, o módulo falha em integridade,
>   compliance ou operação básica.
> - **Importante** — reduz risco relevante, aumenta produtividade ou
>   escala; alto ROI.
> - **Desejável** — melhoria significativa mas não bloqueante.
> - **Futura** — depende de contexto/escala/mercado (Open Finance,
>   multi-moeda, GRC) e deve ficar no roadmap.

Cada linha traz **Categoria · Justificativa · Prioridade alinhada**
(P0-P3 conforme `MATRIZ-PRIORIZACAO-CONCILIACAO.md`).

---

## Essenciais

| Capacidade | Categoria | Justificativa | Prioridade |
|---|---|---|---|
| Confirmação transacional atômica (baixa + conciliação + livro) | Arquitetura/Financeiro | Sem atomicidade, existem baixas conciliadas sem cabeçalho e estados parciais (A7/A8/J1). | P0 |
| Cabeçalho `conciliacao_bancaria` obrigatório | Banco/Auditoria | Livro de conciliação é pré-requisito legal e operacional. | P0 |
| Bloqueio de período fechado | Governança | Impede mutação retroativa em mês fechado; base para fechamento contábil. | P0 |
| Motivo obrigatório e trilha em desfazer/estornar | Auditoria/Segurança | Compliance e reconstituição. | P0 |
| Deduplicação por hash de arquivo + fingerprint de transação | Processo | Evita reprocessamento e duplicidade financeira. | P0 |
| Restrição de DELETE em `financeiro_extrato_importacoes` | Segurança | Reduz perda silenciosa (H6). | P0 |
| Tratamento correto de OFX multi-conta | Captura | Evita mistura de FITIDs entre contas (B8). | P0 |
| Engine única de matching com score decomposto | Matching | Elimina duas engines coexistentes com thresholds divergentes. | P1 |
| Modelo canônico único da transação | Normalização | Base para regra, matching, ML e auditoria consistentes. | P1 |
| Workflow completo (Pendente → Sugerido → Revisão → Conciliado → Baixado → Auditado → Fechado) | Workflow | Habilita SLA, aprovação e fechamento. | P1 |
| RLS + segregação de funções (importar × conciliar × aprovar) | Segurança | Compliance SOX/LGPD e antifraude básica. | P1 |
| Trilha append-only (WORM) de eventos de conciliação | Auditoria | Base legal e evidência incontestável. | P2 |
| Índices críticos e paginação server-side | Performance | Sustenta operação em volumes reais. | P1 |
| Virtualização das listas do painel | UX/Performance | Regra do design system e usabilidade em volume. | P1 |
| KPIs mínimos operacionais (% conciliado, % automático, tempo médio, exceções abertas) | Indicadores | Sem eles não há gestão nem melhoria contínua. | P2 |
| Mascaramento de PII (CPF/CNPJ) em logs e chamadas de IA | Governança/LGPD | Requisito legal. | P2 |

---

## Importantes

| Capacidade | Categoria | Justificativa | Prioridade |
|---|---|---|---|
| Sessão de conciliação persistida (draft) | Workflow | Permite retomada, colaboração e auditoria de tentativas. | P2 |
| Fila de exceções com SLA e responsável | Workflow/UX | Backlog visível reduz risco financeiro e melhora operação. | P2 |
| Aprovação em dois níveis acima de valor/limite | Segurança/Governança | Reduz risco em pagamentos altos e satisfaz auditoria. | P1 |
| Regras versionadas com autor/motivo e simulação (dry-run) | Regras/Governança | Testa antes de ativar; evita regressões silenciosas. | P2 |
| TTL/expiração de aliases | Regras | Alias errado eterno é fonte de rejeição crônica. | P2 |
| Recomendação de nova regra a partir de padrões | Inteligência | Aumenta automação sem custo cognitivo. | P2 |
| Split view extrato ↔ candidatos com breakdown do score | UX | Reduz erro humano e treina o operador. | P2 |
| Bulk actions com preview de impacto financeiro | UX | Produtividade sem perder segurança. | P2 |
| Ajuste com centro de custo "diferença/ajuste" + motivo | Exceção | Contabiliza divergências pequenas sem quebrar fluxo. | P2 |
| Reabertura assistida de sugestões rejeitadas | UX/Workflow | Evita intervenção manual em SQL. | P2 |
| Processamento em fila/worker para parse e score | Performance | Desacopla UI do processamento pesado. | P1 |
| Materialized views para dashboards e KPIs | Performance | Dashboards em tempo real com custo constante. | P2 |
| Timeline lateral por transação | UX/Auditoria | Diagnóstico rápido e transparência. | P2 |
| Detecção de anomalias / duplicidade cruzada | Inteligência/Segurança | Antecipa problemas antes da conciliação. | P2 |
| Alertas inteligentes (extrato faltando, SLA de exceção estourado) | Inteligência | Reduz atraso e retrabalho. | P2 |
| Configuração de thresholds e tolerâncias por empresa | Regras/Configuração | Diferentes clientes têm apetite distinto ao risco. | P2 |
| Dashboard operacional consolidado (book-to-bank) | UX/Governança | Base do fechamento confiável. | P2 |
| Adapter plugável de captura (Strategy/Registry) | Arquitetura/Escalabilidade | Novo banco/canal sem tocar núcleo. | P2 |
| Import CSV/PDF com UI de matching equivalente ao OFX | UX/Processo | Fecha o gap funcional entre canais. | P1 |
| Regras compostas (valor + descrição + contraparte + dia) | Regras | Cobre casos reais que substring/regex não pega. | P2 |
| Revalidação de `can(...)` em ações críticas do hook | Segurança | Defense in depth. | P1 |
| Feature flags e releases canário | Manutenção | Reduz risco de release em módulo crítico. | P2 |
| Testes de integração e E2E do fluxo de confirmação | Qualidade | Base para refatorar com segurança. | P1 |

---

## Desejáveis

| Capacidade | Categoria | Justificativa | Prioridade |
|---|---|---|---|
| Explainable AI ao lado da sugestão ("por que este match?") | Inteligência/UX | Aumenta confiança do usuário no automático. | P2 |
| Aprendizado adaptativo (peso por par extrato↔lançamento) | Matching | Complementa aliases com histórico do par. | P2 |
| Relatório PDF/CSV de conciliação para auditoria externa | Governança | Solicitado por contador/auditor. | P2 |
| Preview do arquivo antes de gravar | UX/Processo | Evita erros antes de persistir. | P3 |
| Drag-and-drop múltiplo + fila de importação | UX | Ganho de produtividade em cargas grandes. | P3 |
| Atalhos de teclado no workbench | UX | Alta produtividade para operadores dedicados. | P3 |
| Onboarding contextual e tour | UX | Reduz curva de aprendizado em novos usuários. | P3 |
| Import/export CSV/JSON de regras e aliases | Regras | Facilita migração e templates por segmento. | P3 |
| Simulação "se aceitar todas ≥ X" | Inteligência/UX | Ajuda a calibrar threshold sem risco. | P3 |
| Webhook "conciliação concluída" | Escalabilidade/Integração | Ativa contábil/BI em tempo real. | P3 |
| Assinatura digital do fechamento | Governança | Prova legal reforçada; não bloqueante hoje. | P3 |
| Storybook + design tokens específicos do módulo | Manutenção | Base para redesenho consistente. | P3 |

---

## Futuras

| Capacidade | Categoria | Justificativa | Horizonte |
|---|---|---|---|
| Open Finance BCB (extrato via API oficial) | Captura/Escala | Substitui OFX manual; depende de credenciamento/DICT. | Médio prazo |
| APIs bancárias diretas (Itaú, BB, Inter, Sicoob) | Captura/Escala | Reduz atrito operacional; cada integração tem custo. | Médio prazo |
| Conciliação de fatura de cartão / adquirentes no mesmo fluxo | Escalabilidade | Unifica visão financeira. | Médio prazo |
| Multi-moeda com câmbio e diferenças cambiais | Escalabilidade | Só relevante se surgirem operações externas. | Longo prazo |
| Multi-filial com contabilização por filial | Escalabilidade | Necessário quando cliente-alvo tiver filiais. | Longo prazo |
| ML/embeddings para similaridade (kNN em `pgvector`) | Matching/Inteligência | Alto valor mas exige governança de modelo. | Médio prazo |
| Isolation Forest para detecção de anomalias | Inteligência/Segurança | Necessário com volume relevante. | Médio prazo |
| Event-driven end-to-end (event bus para BI/contábil) | Arquitetura | Depende de outros módulos consumirem eventos. | Médio prazo |
| Particionamento/archive (empresa+ano) | Escalabilidade | Necessário ao ultrapassar milhões de linhas. | Longo prazo |
| Integração GRC / SOX completa | Governança | Necessário para clientes enterprise regulados. | Longo prazo |
| Reconciliação de PIX/QR agregado com split de valor | Matching/Escalabilidade | Depende do perfil de recebimento do cliente. | Médio prazo |
| Assistente conversacional (chat) sobre conciliação | UX/IA | Diferencial competitivo; depende de maturidade. | Longo prazo |

---

## Critérios de reclassificação

- Uma capacidade **futura** vira **importante** quando surgir demanda
  contratual, obrigação regulatória, ou o volume ultrapassar a
  capacidade atual da arquitetura.
- Uma capacidade **desejável** vira **essencial** quando associada a
  compliance específico do cliente-alvo (ex.: auditoria externa
  recorrente exige relatório PDF).
- Uma capacidade **essencial** só sai da lista após implementada e
  validada por testes E2E + auditoria.

---

## Uso

Este documento alimenta:

1. **Etapa 4** — análise de GAP formal entre AS-IS e o modelo de
   referência, usando esta matriz como espinha dorsal.
2. **Etapa 5** — desenho da arquitetura TO-BE priorizando Essenciais
   e Importantes, com Desejáveis/Futuras marcadas como extensão.
