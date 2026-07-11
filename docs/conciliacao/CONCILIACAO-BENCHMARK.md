# CONCILIAÇÃO FINANCEIRA — BENCHMARK ENTERPRISE

> Estudo comparativo (somente análise). Não altera código, migrations
> ou arquitetura. Referências: TOTVS RM, SAP S/4HANA (FI Bank
> Reconciliation / F.13 / FEBAN / FF.5), Oracle NetSuite (Bank
> Reconciliation + Match Bank Data), Microsoft Dynamics 365 Finance
> (Bank reconciliation + Advanced bank reconciliation), Sankhya,
> Senior ERP, TOTVS Protheus (SIGAFIN/CTB), Conta Azul, Omie, Nibo,
> QuickBooks Online, Xero. Fontes: `CONCILIACAO-AS-IS.md`,
> `CONCILIACAO-GAPS.md`, `MATRIZ-PRIORIZACAO-CONCILIACAO.md`, código
> em `main`, documentação pública dos fornecedores.

---

## 1. Processo geral de conciliação (padrão de mercado)

Ciclo canônico observado em ERPs corporativos:

```
Captura → Normalização → Identificação → Classificação
       → Matching → Validação → Aprovação → Baixa
       → Auditoria → Encerramento (período)
```

| Etapa | O que faz | Por que o mercado adotou |
|---|---|---|
| **Captura** | Ingestão via OFX/CNAB240/CSV/API bancária/Open Finance/Email/RPA. | Independência do canal; resiliência. |
| **Normalização** | Padroniza descrição, favorecido, documento, valor, moeda, natureza (D/C). | Base única para regra, matching e ML. |
| **Identificação** | Deduplicação por FITID/hash e por fingerprint (banco+ag+conta+valor+data). | Evita reprocessamento e duplicidade financeira. |
| **Classificação** | Categoria contábil, centro de custo, natureza operacional. | Preparo para contabilização e DRE. |
| **Matching** | Casa evento bancário com título/lançamento. | Reduz esforço manual. |
| **Validação** | Regras de negócio, tolerâncias, limites, restrições de período. | Impede conciliação inválida. |
| **Aprovação** | Maker/checker acima de valor ou fora de tolerância. | SOX/segregação de funções. |
| **Baixa** | Registra liquidação atômica no razão. | Integridade contábil-financeira. |
| **Auditoria** | Trilha append-only e reprocessamento controlado. | Compliance, LGPD, ISO. |
| **Encerramento** | Fechamento por conta/período com bloqueio. | Confiabilidade do balanço. |

**Racional**: separar etapas permite reprocessar/regravar sem
comprometer as demais e habilita paralelismo (streaming), auditoria
por camada e evolução independente das engines.

---

## 2. Engine de matching

### 2.1 Cardinalidades

| Modo | Uso | ERPs típicos |
|---|---|---|
| 1×1 | Caso comum | Todos |
| N×1 | Um extrato para várias parcelas | SAP F.13, Dynamics ABR, NetSuite Match Bank Data |
| 1×N | Depósito/pagamento agregando várias notas | SAP FEBAN, Protheus FINA640 |
| N×N | Rebateio / split parcial | SAP HANA Cash Management, Oracle Cash Management |

### 2.2 Dimensões e sinais

- **Valor** com tolerância absoluta/percentual e por moeda.
- **Data** com janela assimétrica (D-N, D+N).
- **Documento** (CPF/CNPJ, boleto/linha digitável, chave PIX, NF-e).
- **Contraparte** (nome + Jaccard/Levenshtein/embeddings).
- **Banco/agência/conta** (transferências, TED/DOC).
- **Identificadores** (FITID, EndToEndId, TXID, número boleto,
  referência interna).
- **Natureza** (débito↔a pagar; crédito↔a receber).
- **Histórico** de aceites/rejeições (peso adaptativo).

### 2.3 Estratégias

- **Determinística exata** (identificador único) — máxima confiança.
- **Determinística tolerante** (valor+data+documento).
- **Probabilística** com pesos por dimensão (SAP HANA, Dynamics ABR).
- **ML/embeddings** para similaridade textual (NetSuite AI Match,
  QuickBooks Auto-Categorize).

### 2.4 Vantagens/limitações

- 1×1 barato mas insuficiente para agregadores (PIX QR, TED
  consolidado).
- N×M cobre realidade mas exige UI clara + auditoria detalhada.
- ML aumenta cobertura mas exige explicabilidade e feedback loop.

---

## 3. Score de confiança

Padrão em ERPs modernos: score contínuo [0,1] com decomposição por
dimensão + threshold configurável.

| Faixa | Interpretação | Ação padrão |
|---|---|---|
| ≥ 0.95 | Match forte, identificador único ou combinação exata | Auto-conciliação silenciosa (com log) |
| 0.80-0.94 | Alto | Sugestão destacada / auto quando threshold da empresa autorizar |
| 0.60-0.79 | Médio | Sugestão para revisão humana |
| 0.30-0.59 | Baixo | Candidato listado, sem sugestão principal |
| < 0.30 | Ruído | Não exibir |

**Pesos típicos** (SAP HANA/Dynamics ABR): valor 0.40 · identificador
0.25 · data 0.15 · contraparte 0.15 · natureza 0.05.

**Validações que reduzem score**: período fechado, lançamento
cancelado, moeda distinta, saldo insuficiente, contraparte
divergente do cadastro, histórico de rejeição no par.

**Explicabilidade**: cada sugestão traz breakdown (motivos), como o
"Match Reason" do NetSuite ou o "Match rule evidence" do Dynamics.

---

## 4. Motor de regras

### 4.1 Escopos comuns

- Por **banco/agência/conta**.
- Por **descrição/histórico** (contém/regex/começa/termina).
- Por **valor** (range, sinal, arredondamento).
- Por **contraparte** (documento, alias de nome).
- Por **categoria** (plano de contas, centro de custo).
- Por **evento** (transferência interna, tarifa, IOF, juros).

### 4.2 Parametrização, prioridade e conflitos

- Prioridade numérica + regra "primeira que casa" (SAP), ou
  "highest-specificity wins" (Dynamics/NetSuite).
- Estratégia de conflito explícita: **override**, **merge**, **skip**.
- Simulação (dry-run) antes de ativar (Nibo, QuickBooks).
- Versionamento (`valid_from/valid_to`), autor, motivo.
- Testes unitários da regra (Xero Rules).
- Importação/exportação CSV/JSON e templates por segmento.
- Reaproveitamento entre empresas do grupo (multi-tenant).

### 4.3 Manutenção

- Painel de "regras que não disparam há X dias".
- Painel de "regras que geram muita rejeição" (feedback loop).
- Sugestão de nova regra a partir de padrões repetidos (Nibo/QBO).

---

## 5. Workflow padrão

```
Capturado → Pendente → Sugerido → Em revisão → Conciliado
        → Baixado → Auditado → Fechado
                              ↘ Divergência → Ajuste → volta ao fluxo
                              ↘ Rejeitado → Reabrível com trilha
```

**Vantagens**:

- Estados discretos permitem SLA, filas e métricas por etapa.
- Reabertura controlada (Dynamics ABR "Reopen").
- Fechamento formal por conta/período impede mutação retroativa.
- Segregação natural entre operador, revisor e auditor.

---

## 6. Tratamento de exceções

| Cenário | Prática de mercado |
|---|---|
| Divergência de valor | Marca `diferença` com centro de custo "ajuste"; requer aprovação e motivo (SAP F.13 "Charge off"). |
| Documento inexistente | Cria lançamento provisório a partir do extrato com plano de contas sugerido (QBO "Add"). |
| Duplicidade | Deduplica por hash de arquivo + fingerprint da transação; alerta antes de gravar. |
| Baixa incorreta | Estorno reversível com trilha, motivo obrigatório, aprovação. |
| Múltiplos candidatos | Painel lado a lado com breakdown de score. |
| Sem correspondência | Fila de exceções com SLA e responsável. |
| Transferência interna | Detecção D↔C em contas próprias, marcada como não-receita/despesa. |
| Tarifas/juros/IOF | Reconhecidos por regra e lançados automaticamente. |

---

## 7. Auditoria

- Trilha **append-only** (WORM) por evento.
- Snapshot antes/depois; assinatura hash do arquivo importado.
- Timeline por transação (quem viu, quem sugeriu, quem aprovou,
  quem reverteu).
- Correlação usuário↔sessão↔IP↔empresa.
- Retenção legal e exportação (CSV/PDF/JSON) para auditoria externa.
- Motivo obrigatório em desfazer/estornar.
- Versionamento de regras e aliases.
- Referência a `financeiro_baixas` estornadas e reemissões.

---

## 8. UX

Padrões consolidados:

- **Split view** extrato ↔ candidatos com breakdown do score
  (Dynamics, NetSuite, Xero).
- **Ações em lote** com preview do impacto financeiro.
- **Filtros persistentes** por perfil de usuário (SAP Fiori).
- **Timeline lateral** por transação (NetSuite record history).
- **Painel de exceções** com SLA (QBO Banking Review).
- **Drag-and-drop** múltiplos arquivos, fila com progresso.
- **Atalhos de teclado** (J/K navegação, Enter confirmar, X ignorar) —
  Xero, Nibo.
- **Badges** de status coerentes com o workflow (Pendente/Sugerido/
  Conciliado/Ajustado/Divergente/Fechado).
- **Explicabilidade** ("Por que este match?") ao lado da sugestão.
- **Dashboard operacional** com % conciliado, atrasos, top exceções.
- **Onboarding contextual** e tour do fluxo (QBO/Xero).
- **Acessibilidade WCAG** e responsividade mobile-first.

---

## 9. Performance

- **Ingestão em fila** (SAP Event Mesh, Dynamics batch jobs,
  QBO webhooks) — desacopla UI do processamento.
- **Paginação server-side** com cursor e virtualização client-side.
- **Índices** por (empresa, conta, data), (fitid), (sugestao),
  (status, data_transacao).
- **Materialized views** para dashboards.
- **Cache** de aliases e regras normalizadas.
- **Processamento em lote** com backpressure e retry.
- **Batch matching** por janelas temporais (SAP HANA Smart Match).
- **Workers** para parse/score em segundo plano.
- **Streaming** para arquivos grandes (CNAB de 100k+ linhas).

---

## 10. Escalabilidade

- **Multi-tenant** com isolamento por `empresa_id` e RLS.
- **Multi-filial/multi-conta** com contabilização por filial.
- **Multi-moeda** com câmbio na data e diferenças cambiais.
- **Multi-gateway**: OFX, CNAB240, CNAB400, API bancária direta,
  Open Finance (BCB), PIX, cartões (adquirentes).
- **Adapters plugáveis** por banco (SAP BAdI, NetSuite SuiteApps,
  Dynamics Data Providers).
- **Event-driven**: eventos "extrato.recebido", "match.sugerido",
  "conciliação.confirmada", consumidos por contábil/BI.
- **Sharding lógico** por empresa/ano em bases muito grandes.
- **Retenção/archive** de importações antigas.

---

## 11. Segurança

- **Segregação de funções**: quem importa ≠ quem concilia ≠ quem
  aprova ≠ quem audita.
- **Aprovação em dois níveis** acima de valor/limite.
- **Bloqueio de período** por auditor.
- **Trilha imutável** e detecção de tentativa de mutação.
- **Antifraude**: alerta em pagamentos duplicados, mudança de
  favorecido, valores atípicos.
- **LGPD**: mascaramento de CPF/CNPJ em logs e chamadas de IA,
  data minimization.
- **Assinatura digital** do fechamento (S/4HANA, Protheus CTB).

---

## 12. Indicadores (KPIs)

| KPI | Utilidade |
|---|---|
| % conciliado no período | Saúde do fechamento |
| % automático × manual | Eficiência das engines |
| Tempo médio para conciliar | SLA operacional |
| Divergências abertas | Risco financeiro |
| Exceções por idade | Backlog e SLA |
| Conciliações por operador | Capacidade e treinamento |
| Precisão das sugestões (aceitas/total) | Qualidade do matching |
| Taxa de rejeição por regra | Manutenção do rulebook |
| Retrabalho (estornos/conciliações) | Qualidade de dados |
| Cobertura por banco | Priorização de integrações |
| Tempo entre extrato e conciliação | Frescor da informação |

---

## 13. Inteligência operacional

- **Aprendizado por histórico** (aliases, regras adaptativas).
- **Recomendação de novas regras** a partir de padrões recorrentes.
- **Detecção de anomalias** (Isolation Forest / z-score).
- **Classificação automática** por categoria (embeddings + kNN).
- **Previsão de fluxo de caixa** integrada.
- **Alertas inteligentes** (SLA de exceção, extrato faltando).
- **Explainable AI** — cada sugestão com motivos.
- **Feedback loop** contínuo alimentando a engine.
- **Detecção de duplicidade cruzada** (mesmo pagamento em contas
  diferentes).
- **Sugestão de fechamento** quando 100% conciliado.

Maior valor para o AviZee: aliases adaptativos, regra sugerida a
partir de padrão, anomalias em transferências internas, previsão de
categorização em despesa direta.

---

## 14. Governança

- Trilha completa, LGPD by design, segregação de funções, controle
  de alterações em regras/aliases, evidência de aprovação, política
  de retenção, exportação para auditoria (SOX/ISO 27001), assinatura
  de fechamento, integração com GRC.

---

## 15. Arquitetura conceitual (camadas)

```
┌─ Captura (adapters: OFX / CNAB / API / Open Finance / Email)
├─ Normalização (canonização, dedupe, enriquecimento)
├─ Engine de Regras (aliases, regras, categorias)
├─ Engine de Matching (determinística + probabilística + ML)
├─ Motor de Decisão (thresholds, auto vs revisão, aprovação)
├─ Fila de Revisão (workbench humano)
├─ Conciliação (transacional, atômica)
├─ Baixa (ledger / razão)
├─ Auditoria (WORM, timeline, evidências)
├─ Dashboard/KPIs (materializado, tempo real)
└─ Governança/Encerramento (fechamento, assinatura, retenção)
```

Responsabilidades resumidas:

- **Captura**: independente de canal, idempotente.
- **Normalização**: modelo canônico único.
- **Regras**: declarativas, versionadas, testáveis.
- **Matching**: puro, sem side-effects.
- **Decisão**: aplica política da empresa.
- **Fila**: interface humana com SLA.
- **Conciliação/Baixa**: única fonte de escrita transacional.
- **Auditoria**: append-only, imutável.
- **Dashboard**: leitura otimizada.
- **Governança**: bloqueia, assina, retém.

---

## 16. Comparativo com o projeto atual (síntese)

Ver tabela completa em `COMPARATIVO-ERP.md`. Panorama:

| Área | Projeto | Referência | GAP |
|---|---|---|---|
| Captura | OFX/CSV/PDF | + CNAB240/API/Open Finance | Alto |
| Normalização | Canônica parcial | Completa | Médio |
| Regras | Aliases + regras substring/regex | + versionamento, simulação, prioridade explícita | Médio |
| Matching | Determinístico + fallback IA | + probabilístico multi-sinal + ML + explicabilidade | Alto |
| Score | Duas fórmulas coexistentes | Unificado, decomposto, configurável | Alto |
| Workflow | Estados básicos | Estados completos + aprovação + fechamento | Alto |
| Exceções | Rejeitar/ignorar | Fila com SLA, ajustes com motivo | Alto |
| Auditoria | `financeiro_auditoria` + feedback | WORM, timeline, assinatura | Médio |
| UX | Painel único | Split view, atalhos, breakdown, bulk | Alto |
| Performance | UI-síncrona | Filas, workers, virtualização | Alto |
| Escalabilidade | Empresa única em fluxo | Multi-empresa/filial/moeda/gateway | Médio |
| Segurança | RLS + role | + maker/checker + bloqueio + antifraude | Alto |
| KPIs | 4 KPIs de aprendizado | 10+ KPIs operacionais | Alto |
| Inteligência | Aliases + IA pontual | + anomalias + recomendação de regra + previsão | Alto |
| Governança | Trilha básica | Fechamento assinado + retenção + LGPD end-to-end | Alto |

---

## 17. Recomendações estratégicas (sem propor implementação)

**Obrigatórios**
- Adapter plugável de captura (OFX/CNAB/API/Open Finance).
- Modelo canônico único e engine de matching probabilístico unificado.
- Workflow completo com fechamento por conta/período.
- Trilha WORM e maker/checker acima de limite.
- Confirmação transacional atômica.

**Maior valor operacional**
- Fila de exceções com SLA.
- Bulk actions com preview de impacto.
- Regras versionadas + simulação (dry-run).
- Dashboard operacional com KPIs de eficiência.

**Reduzem riscos financeiros**
- Fechamento formal com assinatura.
- Bloqueio de período fechado.
- Detecção de anomalias/duplicidade cruzada.
- Aprovação em dois níveis acima de valor.

**Diminuem trabalho manual**
- Regras adaptativas + recomendação de regra.
- Classificação automática (categoria/centro de custo).
- Sugestão N×1/1×N.
- Reabertura assistida de sugestões rejeitadas.

**Aumentam escalabilidade**
- Processamento em fila/worker.
- Materialized views para KPIs.
- Adapters plugáveis por banco.
- Particionamento por empresa/ano.

**Melhoram UX**
- Split view + breakdown do score.
- Atalhos de teclado, drag-and-drop múltiplo.
- Timeline por transação, painel de detalhes.
- Onboarding contextual.

**Preparam para o futuro**
- Open Finance BCB, PIX/cartões, multi-moeda.
- Event-driven (eventos para BI/contábil).
- Explainable AI com feedback loop contínuo.
- Governança LGPD/SOX by design.
