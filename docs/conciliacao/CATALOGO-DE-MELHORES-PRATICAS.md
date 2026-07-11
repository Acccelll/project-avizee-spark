# CATÁLOGO DE MELHORES PRÁTICAS — CONCILIAÇÃO FINANCEIRA

> Compilação consolidada das práticas identificadas no benchmark
> (`CONCILIACAO-BENCHMARK.md`, `COMPARATIVO-ERP.md`,
> `MATRIZ-DE-CAPACIDADES.md`). Referência para a Etapa 4 (análise
> formal de GAP AS-IS × TO-BE) e Etapa 5 (arquitetura TO-BE).
> Sem propostas de implementação.

---

## 1. Arquitetura

- **Camadas separadas** por responsabilidade: Captura → Normalização
  → Regras → Matching → Decisão → Fila → Conciliação → Baixa →
  Auditoria → Dashboard → Governança.
- **Motor único** de matching (sem coexistência legado × novo).
- **Adapters plugáveis** por canal (Strategy/Registry): OFX, CNAB240,
  CNAB400, API bancária, Open Finance, PDF/OCR.
- **Repository pattern** entre services e banco para testabilidade.
- **Event-driven**: eventos `extrato.recebido`, `match.sugerido`,
  `conciliacao.confirmada`, `conciliacao.desfeita`,
  `periodo.fechado` consumidos por contábil/BI.
- **Idempotência** em toda ingestão (chave natural + hash).
- **Configuração por empresa** (thresholds, tolerâncias, políticas
  de aprovação) em tabela de configuração, não em código.
- **Feature flags** para releases controlados em módulo crítico.
- **Serviços puros vs. side-effects**: engines de matching e regra
  puras; escrita concentrada em serviços transacionais.

## 2. Processo

- Ciclo canônico: Captura → Normalização → Identificação →
  Classificação → Matching → Validação → Aprovação → Baixa →
  Auditoria → Encerramento.
- **Deduplicação** por hash do arquivo + fingerprint da transação
  (banco + agência + conta + valor + data + doc).
- **Preview antes de gravar** para importações grandes.
- **Sessão de conciliação persistida** (draft) com retomada.
- **Reabertura controlada** com trilha e motivo.
- **Reprocessamento** de sugestões por lote quando regras mudam.
- **Fechamento formal** por conta/período com assinatura.
- **Segregação captura × conciliação × aprovação × auditoria**.
- **Ajustes contabilizáveis** para pequenas diferenças (charge-off).

## 3. Banco de Dados

- **Modelo canônico único** da transação bancária.
- **Segregação** de canônico, estado e sugestão em tabelas ou
  colunas claramente distintas.
- **Chaves naturais** para deduplicação (`empresa_id + conta + fitid`
  e `empresa_id + fingerprint`).
- **FKs reais** entre baixa, evento bancário e cabeçalho de lote.
- **Constraints** `chk_*` para estados (`pendente|em_revisao|
  conciliado|ajustado|divergente|fechado`).
- **Índices** por (empresa, conta, data), (fitid), (status,
  data_transacao), (sugestao_lancamento_id).
- **Materialized views** para KPIs e dashboards.
- **Particionamento** por empresa/ano em tabelas quentes.
- **Retenção/archive** para importações antigas.
- **Versionamento** de regras/aliases (`valid_from/valid_to`,
  autor, motivo).
- **Trilha append-only** (WORM) em tabela separada, sem UPDATE/DELETE.
- **Fechamento** materializado em tabela específica (`fechamentos_
  conciliacao`) com hash de assinatura.

## 4. Matching

- **Cardinalidades**: 1×1, N×1, 1×N e (quando cabível) N×N.
- **Sinais múltiplos**: valor, data, identificador (FITID/
  EndToEndId/boleto), documento, contraparte, banco/agência/conta,
  natureza D/C.
- **Estratégias combinadas**: determinística exata → determinística
  tolerante → probabilística → ML/embeddings.
- **Score contínuo [0,1]** com decomposição por dimensão.
- **Thresholds configuráveis** por empresa/conta.
- **Explicabilidade** ("por que este match?") ao lado da sugestão.
- **Feedback loop**: aceites/rejeições reajustam pesos por par.
- **Detecção de transferências internas** e agregados (PIX QR).
- **Tolerâncias configuráveis** por moeda/canal.
- **Cache** de candidatos normalizados por janela temporal.

## 5. Regras

- **Escopo** por banco, conta, descrição, valor, contraparte,
  categoria, evento.
- **Prioridade explícita** com desempate documentado
  (highest-specificity / first-match).
- **Versionamento** com autor, motivo, `valid_from/valid_to`.
- **Simulação (dry-run)** antes de ativar.
- **Sugestão automática** de novas regras a partir de padrões
  recorrentes.
- **Regras compostas** (AND/OR entre condições).
- **Manutenção assistida**: painel de regras que não disparam ou
  geram rejeição crônica.
- **Import/export** CSV/JSON para migração e templates.
- **TTL** de aliases; expiração e revisão obrigatória.
- **Testes unitários** da regra em CI.

## 6. Workflow

- Estados discretos: **Pendente → Sugerido → Em revisão →
  Conciliado → Baixado → Auditado → Fechado**, com desvios
  **Ajuste/Divergência** e **Rejeitado (reabrível)**.
- **SLA por estado** com alerta automático.
- **Aprovação em dois níveis** acima de limite.
- **Fechamento por conta/período** que bloqueia mutação.
- **Reabertura** com evento auditável.
- **Fila de exceções** priorizada por idade/valor.
- **Bulk actions** com preview de impacto financeiro.

## 7. UX

- **Split view** extrato ↔ candidatos com breakdown do score.
- **Painel de exceções** com filtros por idade/valor/motivo.
- **Timeline lateral** por transação (quem, quando, o quê).
- **Atalhos de teclado** (J/K, Enter, X, ⌘/Ctrl+Z).
- **Drag-and-drop múltiplo** com fila e progresso individual.
- **Preview do arquivo** antes de gravar.
- **Ações em lote** com resumo do impacto (valor total, contas
  afetadas, período).
- **Dashboards operacionais** (book-to-bank, % conciliado, atraso,
  top exceções).
- **Explicabilidade** visível ao lado da sugestão.
- **Acessibilidade WCAG AA**, foco visível, contraste.
- **Design system consistente** entre mobile e desktop.
- **Onboarding contextual** e tour do fluxo.
- **Zero `window.confirm`**; sempre diálogos do design system.

## 8. Performance

- **Processamento em fila/worker** (parse, score, transferências).
- **Streaming** para arquivos grandes; sem carregar tudo em memória.
- **Batch matching** por janelas temporais.
- **Paginação server-side** com cursor.
- **Virtualização client-side** de listas grandes (`react-virtual`).
- **Materialized views + índices dedicados** para KPIs.
- **Cache** de aliases e regras normalizadas.
- **Backpressure** e retry com jitter em integrações externas.
- **Batching** de UPDATEs pós-confirmação (evitar N×UPDATE).

## 9. Segurança

- **RLS** por empresa e camadas adicionais para dados sensíveis.
- **Segregação de funções** (importar × conciliar × aprovar ×
  auditor).
- **Maker/checker** obrigatório acima de limite.
- **Bloqueio de período** fechado.
- **Detecção antifraude** (duplicidade cruzada, mudança de
  favorecido, valores atípicos).
- **Mascaramento de PII** em logs e chamadas de IA.
- **Rate-limit** client + server em endpoints de IA/consulta.
- **Assinatura hash** de arquivos importados e de fechamentos.
- **Revalidação de permissão** em ações críticas do client.
- **Restrições de DELETE** em tabelas transacionais.

## 10. Auditoria

- **Trilha append-only (WORM)** por evento com snapshot antes/depois.
- **Correlação** usuário↔sessão↔IP↔empresa↔transação.
- **Timeline por transação** consultável.
- **Motivo obrigatório** em estorno/desfazer/rejeição.
- **Versionamento** de regras, aliases e thresholds.
- **Retenção legal** com exportação (CSV/PDF/JSON).
- **Assinatura de fechamento** por auditor.
- **Reprocessamento controlado** com evidência.

## 11. Escalabilidade

- **Multi-tenant** com isolamento total por empresa.
- **Multi-filial** com contabilização por filial.
- **Multi-moeda** com câmbio na data e reconciliação cambial.
- **Multi-gateway** via adapters plugáveis (OFX, CNAB, API, Open
  Finance).
- **Particionamento** por empresa/ano em tabelas grandes.
- **Archive** de importações antigas.
- **Event bus** para downstream (contábil, BI).
- **Idempotência** ponta-a-ponta.
- **Horizontal scale** via workers stateless.

## 12. Inteligência Operacional

- **Aliases adaptativos** com peso por histórico.
- **Regras adaptativas** que se ajustam ao feedback.
- **Recomendação de nova regra** a partir de padrões recorrentes.
- **Detecção de anomalias** (z-score, Isolation Forest).
- **Alertas inteligentes** (extrato faltando, SLA estourado,
  divergência recorrente por contraparte).
- **Explainable AI** com breakdown de motivos.
- **Previsão de categorização** para despesa direta.
- **Sugestão de fechamento** quando 100% conciliado.
- **Simulação** ("se aceitar todas ≥ X").
- **Detecção de duplicidade cruzada** entre contas.

## 13. Governança

- **LGPD by design**: minimização, mascaramento, retenção.
- **Segregação de funções** e evidência de aprovação.
- **Controle de alterações** em regras/aliases/thresholds.
- **Trilha imutável** com hash e assinatura.
- **Fechamento formal** com assinatura de auditor.
- **Política de retenção** e exportação para auditoria externa.
- **Documentação viva** no CI (docs versionados junto ao código).
- **KPIs de qualidade** publicados (precisão, retrabalho, cobertura).
- **Integração com GRC** para clientes regulados (roadmap).

---

## Uso

Este catálogo é a **referência canônica** para as próximas etapas:

- **Etapa 4** — análise formal de GAPs entre o AS-IS (código + docs
  atuais) e cada item deste catálogo, priorizando com base na
  `MATRIZ-DE-CAPACIDADES.md`.
- **Etapa 5** — desenho da arquitetura TO-BE, mapeando cada
  Essencial/Importante em camadas, contratos e responsabilidades.
- **Etapas seguintes** — plano de implementação, migração e
  observabilidade.
