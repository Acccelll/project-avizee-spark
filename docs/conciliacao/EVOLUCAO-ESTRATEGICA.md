# EVOLUÇÃO ESTRATÉGICA — CONCILIAÇÃO PARA NÍVEL ENTERPRISE

> Grandes evoluções estruturais recomendadas para elevar o módulo
> de conciliação ao padrão de ERPs corporativos modernos. Documento
> de direção para a **Etapa 5 — Arquitetura TO-BE**. Não descreve
> tecnologias específicas nem implementação.
>
> Fontes: `CONCILIACAO-AS-IS.md`, `CONCILIACAO-GAPS.md`,
> `CONCILIACAO-BENCHMARK.md`, `COMPARATIVO-ERP.md`,
> `MATRIZ-DE-CAPACIDADES.md`, `CATALOGO-DE-MELHORES-PRATICAS.md`,
> `CONCILIACAO-GAP-TOTVS.md`, `REQUISITOS-PROXIMA-GERACAO.md`,
> `MATRIZ-DE-PRIORIZACAO.md`.

Para cada evolução: **Motivação · Escopo conceitual · Requisitos
cobertos · Benefícios · Impacto/ROI · Pré-requisitos · Risco de
não fazer**.

---

## E1. Engine única de Matching (probabilística + explicável)

- **Motivação**: hoje coexistem duas engines (legado + Motor
  Universal) com thresholds divergentes (0,9 / 0,7 / 0,5), gerando
  dupla verdade e comportamento inconsistente.
- **Escopo conceitual**: uma única engine pura, sem side-effects,
  que combina estratégias determinística exata → determinística
  tolerante → probabilística (pesos por dimensão) → opção ML no
  futuro. Score decomposto por dimensão (valor, data, identificador,
  documento, contraparte, natureza, histórico) exposto na UI.
- **Requisitos cobertos**: RF-04, RF-05, RF-07, RF-08, RF-30 (G13,
  G35, G37, G45).
- **Benefícios**: coerência, explicabilidade, base para ML,
  configuração por empresa.
- **Impacto/ROI**: alto — remove classe inteira de bugs, aumenta
  precisão e confiança do operador.
- **Pré-requisitos**: modelo canônico único (E2).
- **Risco de não fazer**: dívida técnica cresce; qualquer nova regra
  precisa ser duplicada.

## E2. Modelo Canônico Único e Camada de Normalização

- **Motivação**: hoje há `TransacaoCanonica` + `StagedTx` + campos
  espalhados em `financeiro_extrato_importacoes` (27 colunas
  heterogêneas).
- **Escopo conceitual**: uma única representação para todos os
  canais (OFX/CSV/PDF/CNAB/API/Open Finance), separando canônico ×
  estado × sugestão. Camada de normalização dedicada com
  enriquecimento por documento e contraparte.
- **Requisitos**: RF-03, RF-17, RF-33 (G14, G40, G49).
- **Benefícios**: base uniforme para regras, matching, KPIs e ML;
  permite adicionar novos canais sem tocar núcleo.
- **Impacto/ROI**: alto — habilita todas as demais evoluções.
- **Pré-requisitos**: —.
- **Risco de não fazer**: cada novo canal exige refactor cruzado.

## E3. Motor de Regras Versionado com Simulação (Dry-Run)

- **Motivação**: regras/aliases sem versão, sem autor/motivo, sem
  simulação — mudanças críticas vão direto a produção.
- **Escopo**: versionamento (`valid_from/valid_to`), autor, motivo,
  simulação dry-run mostrando impacto antes de ativar, testes
  automatizados por regra, painel de manutenção (regras sem uso,
  aliases com muita rejeição), regras compostas (AND/OR).
- **Requisitos**: RF-09, RF-10, RF-11, RF-39 (G32, G33, G34, G73).
- **Benefícios**: evolução segura, base para recomendação
  automática, menos falha operacional.
- **Impacto/ROI**: alto — reduz retrabalho e amplia automação.
- **Pré-requisitos**: E2, RNF-06 (WORM).
- **Risco de não fazer**: regras erradas mantidas indefinidamente,
  compliance frágil.

## E4. Workflow de Aprovação e Fechamento

- **Motivação**: sem estados discretos completos, sem aprovação
  maker/checker, sem fechamento formal — permite mutação retroativa
  e viola SoD.
- **Escopo**: estados **Pendente → Sugerido → Em revisão →
  Conciliado → Baixado → Auditado → Fechado**, com Ajuste/Divergência
  e Rejeitado (reabrível). Aprovação em dois níveis acima de
  limite. Fechamento por conta/período com assinatura + hash.
- **Requisitos**: RF-12, RF-14, RF-15, RF-24, RF-32 (G17, G18, G04,
  G69).
- **Benefícios**: compliance SOX/LGPD, integridade contábil, base
  para KPIs e SLA.
- **Impacto/ROI**: alto — bloqueia mutação retroativa e habilita
  fechamento confiável.
- **Pré-requisitos**: E6 (auditoria WORM).
- **Risco de não fazer**: risco fiscal e trabalhista real.

## E5. Confirmação Transacional Atômica (Livro de Conciliação)

- **Motivação**: `handleConfirmarConciliacao` executa múltiplas RPCs
  com `try/catch` silencioso — pode gerar baixa conciliada sem
  cabeçalho de lote.
- **Escopo**: RPC única transacional (ou saga com compensação
  explícita) que grava baixa, marca extrato, cria cabeçalho
  (`conciliacao_bancaria`) e pares (`conciliacao_pares`) de forma
  atômica.
- **Requisitos**: RF-22, RF-23 (G01, G02, G03).
- **Benefícios**: elimina inconsistências; base para eventos
  downstream e auditoria correta.
- **Impacto/ROI**: crítico — pré-requisito absoluto para qualquer
  compliance.
- **Pré-requisitos**: —.
- **Risco de não fazer**: dados financeiros inconsistentes em
  produção.

## E6. Auditoria Corporativa (WORM + Timeline + Snapshots)

- **Motivação**: `financeiro_auditoria` é mutável; sem snapshot
  antes/depois; sem timeline por transação.
- **Escopo**: trilha append-only (WORM) por evento, snapshots
  antes/depois, correlação usuário↔sessão↔IP↔empresa, timeline
  consultável por transação, exportação padronizada para auditoria
  externa, versionamento de regras/aliases/thresholds.
- **Requisitos**: RNF-06, RF-19, RF-25, RF-28, RF-41 (G05, G30, G43,
  G47, G48, G64, G65).
- **Benefícios**: compliance LGPD/SOX/ISO, evidência incontestável,
  suporte a disputas.
- **Impacto/ROI**: alto — habilita fechamento assinado e aprovação
  maker/checker.
- **Pré-requisitos**: —.
- **Risco de não fazer**: exposição legal e regulatória.

## E7. Dashboard Operacional (Book-to-Bank + KPIs + SLA)

- **Motivação**: hoje só existem 4 KPIs de aprendizado; sem visão
  book-to-bank, sem SLA de exceção, sem métricas de eficiência.
- **Escopo**: dashboard com % conciliado, % automático, tempo médio
  de conciliar, exceções por idade, precisão do matching,
  retrabalho, cobertura por banco; visão book-to-bank (saldo inicial
  + movimentos + saldo final × banco); alertas de SLA e de "extrato
  faltando".
- **Requisitos**: RF-26, RF-27, RF-40 (G41, G42, G56, G67).
- **Benefícios**: gestão baseada em dados; melhoria contínua;
  antecipação de problemas.
- **Impacto/ROI**: alto — necessário para amadurecer a operação.
- **Pré-requisitos**: E4 (workflow), E5 (atomicidade), E6 (trilha).
- **Risco de não fazer**: gestão cega; problemas só aparecem no
  fechamento.

## E8. Inteligência Operacional (Anomalias + Recomendação + Adaptativo)

- **Motivação**: aprendizado atual é limitado a aliases exatos; sem
  anomalias, sem sugestão de nova regra, sem peso adaptativo por
  par, sem previsão.
- **Escopo**: (i) detecção de anomalias e duplicidade cruzada;
  (ii) recomendação de novas regras a partir de padrões; (iii)
  pesos adaptativos por par com feedback loop; (iv) explainable
  AI ao lado das sugestões; (v) sugestão de fechamento quando 100%
  conciliado; (vi) simulação "e se aceitar todas ≥ X".
- **Requisitos**: RF-11, RF-18, RF-30, RF-40, RF-42 (G34, G38, G45,
  G67, G74).
- **Benefícios**: mais automação, menos manual, antifraude
  incorporada.
- **Impacto/ROI**: alto — diferencial competitivo.
- **Pré-requisitos**: E1 (engine única), E3 (regras versionadas),
  E6 (trilha), E7 (KPIs).
- **Risco de não fazer**: automação estagnada, perda para
  concorrentes.

## E9. Processamento Assíncrono (Fila, Worker, Streaming)

- **Motivação**: parse, score e detecção rodam síncronos no client;
  arquivos grandes travam a UI; sem retry/backoff; sem streaming.
- **Escopo**: fila de trabalho (parse → normalização → matching →
  transferências), workers stateless, streaming para arquivos
  grandes, backpressure, retry com jitter, batching de UPDATEs,
  processamento assíncrono do fechamento.
- **Requisitos**: RF-01, RF-16 (fila), RNF-01, RNF-03, RNF-10
  (G21, G22, G23, G24, G25, G57).
- **Benefícios**: UI responsiva; escala horizontal; resiliência.
- **Impacto/ROI**: alto — pré-requisito para volume real.
- **Pré-requisitos**: E2 (canônico), E5 (atomicidade).
- **Risco de não fazer**: teto operacional em dezenas de milhares
  de linhas.

## E10. Extensibilidade Plugável (Adapters de Captura)

- **Motivação**: cada novo banco exige editar `memoExtractors.ts` e
  potencialmente adapters; sem registry.
- **Escopo**: plugin registry para adapters (OFX, CSV, PDF, CNAB240,
  CNAB400, API bancária, Open Finance). Contrato claro
  (metadata → parse → normalize → dedupe → emit canônico). Suporte
  a versão do adapter e feature flags por adapter.
- **Requisitos**: RF-01, RF-33, RNF-08 (G16, G27, G49, G75, G76,
  G77).
- **Benefícios**: novo canal em dias, sem tocar núcleo; abre porta
  para Open Finance e APIs bancárias diretas.
- **Impacto/ROI**: alto no médio prazo.
- **Pré-requisitos**: E2 (canônico), E9 (fila).
- **Risco de não fazer**: cada expansão vira retrabalho.

## E11. Observabilidade Estruturada e SRE do Módulo

- **Motivação**: logs esparsos com `logger.warn/error`; falhas
  engolidas; sem métricas nem tracing.
- **Escopo**: logs estruturados com `trace_id`, `empresa_id`,
  `usuario_id`; métricas RED (Rate/Errors/Duration) por operação;
  tracing de importação e confirmação; alertas por SLO; painel de
  saúde do módulo.
- **Requisitos**: RNF-04, RNF-10 (G28, G60).
- **Benefícios**: diagnóstico rápido; SLA mensurável.
- **Impacto/ROI**: alto no operacional.
- **Pré-requisitos**: —.
- **Risco de não fazer**: incidentes silenciosos; MTTR alto.

## E12. Segregação de Funções, LGPD by Design e Antifraude

- **Motivação**: um único papel `financeiro` faz tudo; PII vai bruto
  para IA; sem alertas de antifraude.
- **Escopo**: papéis distintos (importador × conciliador ×
  aprovador × auditor); mascaramento de PII em logs, IA e
  exportações; retenção e minimização de dados; alertas antifraude
  (favorecido alterado, pagamento duplicado, valor atípico);
  step-up para ações críticas.
- **Requisitos**: RF-14, RF-31, RF-25, RF-18 (G05, G18, G19, G20,
  G38, G46, G65).
- **Benefícios**: compliance LGPD/SOX; redução de risco reputacional.
- **Impacto/ROI**: alto — indispensável para clientes enterprise.
- **Pré-requisitos**: E4 (workflow), E6 (auditoria).
- **Risco de não fazer**: exposição legal e vazamento de PII.

## E13. Event Bus e Ecossistema (Downstream Contábil/BI/Notificações)

- **Motivação**: hoje a conciliação é uma ilha; contábil, BI e
  notificações não são acionados automaticamente.
- **Escopo**: eventos publicados (`extrato.recebido`,
  `match.sugerido`, `conciliacao.confirmada`,
  `conciliacao.desfeita`, `periodo.fechado`) consumidos por
  contabilidade, BI, notificações e webhooks externos.
- **Requisitos**: RF-34, RF-41, RF-42, RF-84 (G50, G64, G67, G84).
- **Benefícios**: integração ampla e tempo real.
- **Impacto/ROI**: médio-alto.
- **Pré-requisitos**: E5 (atomicidade), E11 (observabilidade).
- **Risco de não fazer**: sistemas irmãos defasados.

## E14. Redesenho da Workbench de Conciliação (UX)

- **Motivação**: painel único vertical, muitos controles, sem split
  view, sem atalhos, mobile e desktop divergentes.
- **Escopo**: workbench com split view (extrato ↔ candidatos com
  breakdown), timeline lateral, fila de exceções priorizada, bulk
  actions com preview de impacto, atalhos de teclado,
  drag-and-drop múltiplo, onboarding contextual, unificação
  mobile↔desktop, WCAG AA.
- **Requisitos**: RF-13, RF-19, RF-20, RF-28, RF-29, RF-30, RF-37,
  RF-38, RNF-11 (G29-G31, G43, G44, G51-G55, G66, G70-G72, G85).
- **Benefícios**: produtividade, adoção, satisfação.
- **Impacto/ROI**: alto — usuários finais.
- **Pré-requisitos**: E1 (score explicável), E4 (workflow), E6
  (timeline).
- **Risco de não fazer**: rejeição de usuários e treinamento caro.

---

## Fases sugeridas (visão macro para Etapa 5)

### Fase 0 — Estabilização (obrigatória antes de expansão)
**E5**, **E12 (parcial: SoD + PII)**, **E11** — mais os Quick Wins
P0/P1 (`QUICK-WINS.md`). Sem esta fase, nada avança.

### Fase 1 — Base arquitetural
**E2** (canônico) → **E1** (engine única) → **E3** (regras
versionadas) → **E9** (fila/worker) → **E10** (adapters plugáveis).

### Fase 2 — Workflow e governança
**E4** (aprovação + fechamento) → **E6** (auditoria WORM) → **E12
(completa)** (antifraude + SoD).

### Fase 3 — Gestão e inteligência
**E7** (dashboard book-to-bank + KPIs) → **E8** (inteligência
operacional) → **E13** (event bus) → **E14** (redesenho da
workbench).

### Fase 4 — Expansão estratégica
Novos adapters em E10 (Open Finance, APIs bancárias, CNAB), ML/
embeddings, multi-moeda, multi-filial, assistente conversacional,
integração GRC.

---

## Retorno esperado por evolução (síntese)

| Evolução | ROI curto | ROI médio | ROI longo |
|---|---|---|---|
| E5 Atomicidade + Livro | Muito alto | Alto | Alto |
| E4 Workflow + Fechamento | Alto | Muito alto | Muito alto |
| E6 Auditoria WORM | Médio | Alto | Muito alto |
| E1 Engine única | Alto | Muito alto | Muito alto |
| E2 Canônico único | Alto | Muito alto | Muito alto |
| E9 Fila/worker | Alto | Muito alto | Muito alto |
| E10 Adapters plugáveis | Médio | Muito alto | Muito alto |
| E7 Dashboard/KPIs | Médio | Alto | Alto |
| E8 Inteligência | Médio | Alto | Muito alto |
| E11 Observabilidade | Alto | Alto | Alto |
| E12 SoD/LGPD/Antifraude | Alto | Alto | Muito alto |
| E13 Event bus | Baixo | Médio | Alto |
| E14 Workbench UX | Alto | Alto | Alto |
| E3 Regras versionadas | Médio | Alto | Alto |

---

## Direção para a Etapa 5

A Etapa 5 deve organizar essas evoluções em uma **arquitetura TO-BE
por camadas** (Captura → Normalização → Regras → Matching → Decisão
→ Fila → Conciliação/Baixa → Auditoria → Dashboard → Governança),
definindo contratos claros entre camadas, mecanismos de
extensibilidade (adapters/plugins), garantias transacionais e
eventos publicados. Cada evolução aqui descrita deve mapear
diretamente em um ou mais componentes do TO-BE.
