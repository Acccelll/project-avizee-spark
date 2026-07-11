# GAP ESTRATÉGICO — CONCILIAÇÃO AVIZEE × PADRÃO ENTERPRISE

> Diagnóstico consolidado (somente análise). Não altera código,
> migrations ou arquitetura. Fontes: `CONCILIACAO-AS-IS.md`,
> `CONCILIACAO-GAPS.md`, `MATRIZ-PRIORIZACAO-CONCILIACAO.md`,
> `CONCILIACAO-BENCHMARK.md`, `COMPARATIVO-ERP.md`,
> `MATRIZ-DE-CAPACIDADES.md`, `CATALOGO-DE-MELHORES-PRATICAS.md`,
> código em `main` e banco Supabase.
>
> Legenda de status: **Inexistente · Parcial · Inadequado · Limitado
> · Acoplado · Preparado**. Legenda de prioridade: P0/P1/P2/P3
> (mesma escala da `MATRIZ-PRIORIZACAO-CONCILIACAO.md`).

---

## Parte 1 — GAP Funcional

Tabela por capacidade (síntese; detalhes em `COMPARATIVO-ERP.md`).

| # | Capacidade | Situação atual | Situação ideal | Impacto operacional | Impacto financeiro | Impacto UX | Prioridade | Complexidade |
|---|---|---|---|---|---|---|---|---|
| F1 | Captura multi-canal (OFX/CSV/PDF/CNAB/API/Open Finance) | Parcial (OFX + CSV/PDF sem UI) | Adapters plugáveis por canal | Alto (dependência de OFX manual) | Alto (atraso de fechamento) | Alto | P1 | M/L |
| F2 | Deduplicação por hash e fingerprint transação | Parcial (hash arquivo + FITID) | Fingerprint (banco+ag+conta+valor+data+doc) | Médio | Alto (evita duplo pagamento) | Baixo | P0 | S |
| F3 | Modelo canônico único | Parcial (duas representações) | Um único modelo | Médio | Médio | Médio | P1 | M |
| F4 | Engine de matching unificada | Inadequado (legado + Motor) | Uma engine, score decomposto | Alto | Alto | Alto | P1 | L |
| F5 | Matching N×1 / 1×N persistido | Parcial (checkbox em memória) | Grupos persistidos com trilha | Alto | Alto | Alto | P2 | M |
| F6 | Matching N×N (rebateio) | Inexistente | Suporte com trilha | Médio | Médio | Médio | P3 | L |
| F7 | Score decomposto e explicável | Parcial | Breakdown por dimensão na UI | Médio | Médio | Alto | P2 | S |
| F8 | Thresholds por empresa/conta | Inexistente (constantes) | Configurável | Médio | Médio | Médio | P2 | S |
| F9 | Motor de regras versionado + simulação | Parcial (sem versão/dry-run) | Versão + dry-run + autor/motivo | Alto | Alto | Médio | P2 | M |
| F10 | Aliases com TTL/versionamento | Parcial | TTL + histórico + reversível | Médio | Médio | Baixo | P2 | S |
| F11 | Recomendação de nova regra | Inexistente | Sugestão a partir de padrões | Alto | Médio | Médio | P2 | M |
| F12 | Workflow completo (Pendente→Fechado + Divergência/Ajuste) | Parcial | Estados + SLA + reabertura | Alto | Alto | Alto | P1 | L |
| F13 | Fila de exceções com SLA | Inexistente | Fila priorizada por idade/valor | Alto | Alto | Alto | P2 | M |
| F14 | Aprovação em dois níveis (maker/checker) | Inexistente | Acima de limite configurável | Alto | Alto | Médio | P1 | M |
| F15 | Fechamento por conta/período com assinatura | Inexistente | Bloqueio + assinatura de auditor | Alto | Crítico | Médio | P0 | M |
| F16 | Ajuste contabilizável de divergência | Inexistente | Centro "ajuste" + motivo | Médio | Alto | Médio | P2 | S |
| F17 | Detecção de transferências internas | Parcial | Robusta + reversível | Médio | Médio | Médio | P2 | S |
| F18 | Detecção de anomalias/duplicidade cruzada | Inexistente | Alertas antecipados | Alto | Alto | Médio | P2 | M |
| F19 | Sessão de conciliação persistida (draft) | Inexistente | Draft com retomada | Alto | Médio | Alto | P2 | M |
| F20 | Reabertura assistida de sugestões rejeitadas | Inexistente | UI + trilha | Médio | Baixo | Alto | P2 | S |
| F21 | UI de matching para CSV/PDF | Inexistente | Mesma UI do OFX | Alto | Médio | Alto | P1 | M |
| F22 | Confirmação transacional atômica | Inadequado (multi-RPC + try/catch silencioso) | RPC única/saga com compensação | Crítico | Crítico | Médio | P0 | M |
| F23 | Cabeçalho obrigatório `conciliacao_bancaria` | Parcial | Obrigatório em todo lote | Alto | Alto | Médio | P0 | S |
| F24 | Bloqueio de período fechado | Inexistente | Bloqueio ligado a `fechamentos_mensais` | Alto | Crítico | Médio | P0 | S |
| F25 | Motivo obrigatório em desfazer/estornar | Inexistente | Motivo + step-up | Médio | Alto | Médio | P0 | S |
| F26 | KPIs operacionais (% conciliado, tempo médio, exceções) | Inexistente | Dashboard + materialized views | Alto | Médio | Alto | P2 | M |
| F27 | Visão book-to-bank (saldo × banco) | Inexistente | Painel do mês por conta | Alto | Alto | Alto | P2 | M |
| F28 | Timeline por transação | Inexistente | Trilha lateral | Médio | Médio | Alto | P2 | S |
| F29 | Bulk actions com preview de impacto | Parcial | Preview + confirmação DS | Alto | Médio | Alto | P2 | S |
| F30 | Explainable AI ao lado da sugestão | Parcial | Motivos visíveis | Médio | Médio | Alto | P2 | S |
| F31 | Mascaramento de PII em logs/IA | Inexistente | Mascarar CPF/CNPJ | Médio | Alto (LGPD) | Baixo | P2 | S |
| F32 | Assinatura hash do fechamento | Inexistente | Hash + auditor | Médio | Alto | Baixo | P3 | S |
| F33 | Adapter plugável por banco | Inexistente (regex hard-coded) | Plugin registry | Alto | Médio | Médio | P2 | M |
| F34 | Event-driven downstream (contábil/BI) | Inexistente | Eventos publicados | Alto | Médio | Baixo | P2 | M |
| F35 | Multi-conta em um único OFX | Inexistente | Distribuição por `BANKACCTID` | Médio | Alto (risco de mistura) | Médio | P0 | S |

---

## Parte 2 — GAP Arquitetural

| Aspecto | Situação atual | Situação ideal | GAP |
|---|---|---|---|
| Separação de responsabilidades | Hook God object (867 LoC), regra em UI | Camadas: Captura/Normalização/Regras/Matching/Decisão/Conciliação/Auditoria/Dashboard | Alto |
| Escalabilidade | Processamento síncrono no client | Filas/workers, streaming, adapters plugáveis | Alto |
| Modularização | Duas engines coexistentes | Motor único + serviços puros | Alto |
| Reutilização | Duplicação (`normalizarDescricao`, loaders vs queries) | Utilitários únicos, tipos centralizados | Médio |
| Acoplamento | Services chamam `supabase` direto; UI conhece schema | Repository pattern, contratos TS centralizados | Médio |
| Testabilidade | Testes só de parser/score | Testes de integração/E2E + engine pura | Alto |
| Extensibilidade | Novo banco = editar `memoExtractors.ts` | Plugin registry | Médio |
| Flexibilidade | Thresholds constantes | Config por empresa/conta | Médio |
| Observabilidade | `logger.warn/error` esparso; `try/catch` silencioso (A8) | Logs estruturados, métricas, tracing por evento | Alto |
| Resiliência | Falha silenciosa; sem retry/backoff | Idempotência, retry com jitter, saga | Alto |
| Governança | Trilha básica mutável | WORM + versionamento + fechamento assinado | Alto |

**Limitações que impedem crescimento**: (i) coexistência de duas
engines com thresholds divergentes; (ii) confirmação não atômica;
(iii) hook único que cresce sem estrutura; (iv) captura acoplada
a OFX+regex de bancos; (v) ausência de fila/worker; (vi) falta de
observabilidade estruturada.

---

## Parte 3 — GAP de Processo

- **Etapas ausentes**: identificação por fingerprint, validação
  contra período fechado, aprovação, fechamento formal, ajuste
  contabilizável, encerramento auditado.
- **Etapas redundantes**: parse local + Motor Universal em paralelo;
  duas listagens de lançamentos (loaders vs queries).
- **Etapas manuais**: reabertura de rejeição (SQL); resolução de
  divergência; conciliação de CSV/PDF.
- **Riscos**: race no `handleFileSelect`; sobrescrita de sugestão em
  linha conciliada; escolha "mais recente" na baixa; ausência de
  livro (J1/J2/J3).
- **Retrabalho**: reload de período inteiro pós-confirmação; sem
  invalidação de cache global; sem sessão persistida.
- **Sem validação**: multi-conta OFX, período fechado, moeda,
  lançamento cancelado (regra só no service).
- **Automação faltando**: recomendação de regra, anomalias,
  classificação em despesa direta, transferências N×1.
- **Gargalos**: matching JS síncrono, N+1 no `scoreExtratoPendentes`,
  transferências O(n²), sem virtualização.

---

## Parte 4 — GAP de Banco de Dados

- **Modelagem**: `financeiro_extrato_importacoes` mistura canônico,
  hint, estado, flags (27 colunas). Ideal: `..._events`, `..._matches`,
  `..._states` separados.
- **Relacionamentos**: `financeiro_baixas.conciliacao_extrato_referencia`
  é FITID solto, sem FK. `conciliacao_bancaria` opcional (fluxo
  funciona sem cabeçalho).
- **Múltiplos bancos**: sem plugin registry; sem coluna de canal na
  linha.
- **Múltiplas empresas**: RLS ok; falta `empresa_id` explícito na
  chave `(conta, fitid)`.
- **Múltiplas contas**: OK, mas sem particionamento por conta em
  volume.
- **Histórico**: sem versionamento de regras/aliases/thresholds.
- **Auditoria**: `financeiro_auditoria` mutável; sem WORM; sem
  snapshot antes/depois.
- **Rastreabilidade**: sem timeline por transação; sem correlação
  usuário↔sessão↔evento.
- **Índices ausentes**: `sugestao_lancamento_id`, `status`,
  `data_transacao`, `(empresa, conta, data)`.
- **Escala**: sem particionamento em `financeiro_matching_feedback`
  e `financeiro_extrato_importacoes`; sem archive.
- **Constraints faltantes**: cancelar+conciliar (regra só no service);
  prioridade de regras sem `UNIQUE`.

---

## Parte 5 — GAP de UX

- **Produtividade**: painel único vertical com muitos controles;
  sem atalhos de teclado; sem bulk avançado; sem preview de impacto.
- **Cliques**: reabrir rejeição = zero via UI; desfazer usa
  `window.confirm`; export força reload; sem drag-and-drop múltiplo.
- **Navegação**: mobile vs desktop divergem; filtros duplicados
  (`AdvancedFilterBar` + filtros locais).
- **Busca**: sem busca por documento/contraparte no painel.
- **Indicadores**: só 4 KPIs de aprendizado; sem % conciliado,
  atraso, exceções por idade.
- **Painéis**: sem timeline lateral, sem split view com breakdown,
  sem detalhe do extrato.
- **Visualização**: sem virtualização — painéis grandes travam.
- **Ações em lote**: aceitar lote existe; ignorar/rejeitar/reabrir
  não.
- **Revisão manual**: sem fila explícita; sem SLA visível.
- **Fluxo**: CSV/PDF fora do fluxo visual; feedback do Motor
  invisível ao usuário.
- **Acessibilidade**: não verificada.

---

## Parte 6 — GAP de Automação

| Oportunidade | Situação | Impacto esperado |
|---|---|---|
| Matching automático acima de threshold configurável por empresa | Existe (0,9 fixo) | Reduz revisão manual em 20-40% |
| Classificação automática (categoria/centro de custo) | Inexistente | Elimina passo manual em despesa direta |
| Regras adaptativas (peso do par ajustado por feedback) | Parcial | Aumenta precisão em 5-15% |
| Recomendação de nova regra a partir de padrões | Inexistente | Sugere regras que evitam repetição manual |
| Agrupamento automático (N×1/1×N/transferências) | Parcial | Cobre agregadores (PIX QR, TED consolidado) |
| Conciliação parcial (split de valor) | Inexistente | Cobre pagamento parcial e taxas |
| Sugestão inteligente (motivos + explainability) | Parcial | Reduz erro humano |
| Alertas (extrato faltando, SLA de exceção, anomalia) | Inexistente | Antecipa problemas |
| Fila de background para parse/score | Inexistente | Libera UI em arquivos grandes |
| Processamento assíncrono do fechamento | Inexistente | Fechamento sem trava de UI |

---

## Parte 7 — GAP de Auditoria

| Aspecto | Atual | Ideal |
|---|---|---|
| Logs | `logger.warn/error`; parte engolida | Estruturados + níveis + trace-id |
| Histórico | `financeiro_matching_feedback` | + snapshots antes/depois em WORM |
| Rastreabilidade | Autor em feedback; ausente na baixa se A8 dispara | Usuário↔sessão↔empresa↔evento em toda escrita |
| Reversões | Estorno existe; sem motivo | Motivo + aprovação + trilha |
| Justificativas | Ausentes | Obrigatórias em desfazer/ajuste |
| Alterações em regras/aliases | Sem histórico | Versionadas com autor/motivo |
| Aprovação | Ausente | Registro maker/checker |

---

## Parte 8 — GAP de Performance

| Volume | Situação atual | Gargalos previstos |
|---|---|---|
| 100k | Aceitável em backend; UI degrada | Matching JS síncrono, sem virtualização, N+1 |
| 500k | Crítico | Reload total pós-confirmação, sem materialized view, sem índice em `sugestao_*`/`status` |
| 1M | Inviável no desenho atual | Parser em memória, transferências O(n²), sem particionamento |
| 10M | Inviável | Sem sharding lógico, sem archive, sem fila; feedback sem partição |

Riscos futuros: crescimento indefinido de `financeiro_matching_feedback`,
`financeiro_extrato_importacoes` e `conciliacao_bancaria` sem retenção.

---

## Parte 9 — GAP de Escalabilidade

| Frente | Estado |
|---|---|
| Open Finance BCB | Inexistente |
| APIs bancárias diretas (Itaú/BB/Inter/Sicoob) | Inexistente |
| CNAB240/CNAB400 | Inexistente |
| OFX | Completo |
| PIX (EndToEndId/QR) | Parcial (extração de MEMO por regex) |
| Cartões / adquirentes | Fora deste módulo |
| Gateways de pagamento (MP, RecargaPay) | Parcial (regex de MEMO) |
| Novos bancos | Requer editar `memoExtractors.ts` |
| Novas empresas | OK (RLS) |
| Novas filiais | Sem contabilização por filial |
| Novas moedas | Inexistente |

---

## Parte 10 — GAP de Segurança

- **Permissões**: `PermissionRoute` na rota; ações críticas no hook
  não revalidam `can(...)`.
- **Segregação de funções**: um único papel `financeiro` faz tudo.
- **Logs**: sem trace-id; sem correlação IP↔sessão.
- **Auditoria**: mutável por admin.
- **Prevenção de fraude**: sem alerta em favorecido alterado,
  pagamento duplicado, valor atípico.
- **Rollback**: existe, sem motivo, sem step-up.
- **Validações**: multi-conta OFX, período fechado, lançamento
  cancelado — ausentes ou só no service.
- **Consistência**: RPC múltipla não atômica (A7/A8).

---

## Parte 11 — GAP de Governança

- Sem fechamento formal com assinatura.
- Trilha auditável mutável.
- LGPD parcial: CPF/CNPJ enviado bruto para IA.
- Sem controle de alterações em regras/aliases (autor/motivo/versão).
- Sem política de retenção nem exportação padronizada para auditor
  externo.
- Sem controles internos automatizados (SoD, aprovação, alerta).

---

## Parte 12 — Requisitos Funcionais (resumo — detalhe em `REQUISITOS-PROXIMA-GERACAO.md`)

Requisitos consolidados: captura multi-canal com adapters, modelo
canônico único, engine de matching unificada com score explicável,
regras versionadas com dry-run, workflow completo com aprovação e
fechamento, fila de exceções, trilha WORM, KPIs operacionais,
book-to-bank, detecção de anomalias, ajuste contabilizável,
integração com Open Finance/APIs bancárias, event bus.

## Parte 13 — Requisitos Não Funcionais (resumo)

Desempenho (subsegundo em painéis até 100k), disponibilidade (SLO
99,5%), escalabilidade horizontal, observabilidade (logs
estruturados + tracing + métricas), segurança (RLS + SoD + WORM +
mascaramento PII), rastreabilidade end-to-end, manutenibilidade
(hooks decompostos, contratos TS), extensibilidade (plugin registry),
testabilidade (integração + E2E), confiabilidade (idempotência +
saga).

---

## Parte 14 — Matriz de Priorização (resumo)

Ver `MATRIZ-DE-PRIORIZACAO.md` para tabela completa. Panorama:

- **P0**: F2, F15, F22, F23, F24, F25, F35 + H6 (DELETE) — integridade
  financeira / compliance / risco de perda.
- **P1**: F1, F3, F4, F12, F14, F21, D1/D3/D4/D8, A1/A2, E7 —
  operação, performance, arquitetura de base.
- **P2**: F5, F7-F11, F13, F16-F20, F26-F31, F33, F34, A3-A6, B3-B10,
  C1-C10, G-vários, H-vários — UX, arquitetura, governança.
- **P3**: F6, F32 + itens de escala/futuro — refinamentos e
  capacidades futuras.

---

## Parte 15 — Quick Wins (ver `QUICK-WINS.md`)

Itens de baixo esforço, alto impacto, aplicáveis rapidamente após
o redesenho: remover `try/catch` silencioso, restringir DELETE,
motivo obrigatório em desfazer, thresholds configuráveis, índices
faltantes, unificar `normalizarDescricao`, invalidação de queries
pós-confirmação, `EmptyState`/`ConfirmDialog` do DS no lugar do
`window.confirm`, mascaramento de PII antes da IA.

---

## Parte 16 — Grandes Evoluções (ver `EVOLUCAO-ESTRATEGICA.md`)

Engine de matching única e probabilística, motor de regras
versionado com dry-run, workflow com aprovação e fechamento, trilha
WORM, dashboard operacional book-to-bank, inteligência (anomalias,
recomendação de regra), processamento assíncrono via fila,
adapters plugáveis para novos canais (Open Finance/CNAB/API).

---

## Parte 17 — Visão Estratégica

**O que diferencia hoje o AviZee de ERPs enterprise**
- Ausência de fechamento formal, aprovação e trilha imutável.
- Duas engines com thresholds divergentes.
- Confirmação não atômica com falha silenciosa.
- Captura restrita a OFX + regex por banco; sem CNAB/API/Open Finance.
- UX sem split view/breakdown/atalhos/bulk avançado; sem KPIs
  operacionais.
- Escala limitada por processamento síncrono e ausência de índices/
  materialized views/particionamento.

**Maiores riscos da arquitetura atual**
1. Baixas conciliadas sem cabeçalho de lote (A7/A8/J1).
2. Mutação retroativa em período fechado (F24).
3. Multi-conta em OFX misturando FITIDs (F35).
4. DELETE amplo em extrato importado (H6).
5. Fallback "mais recente" concilia baixa errada (J3).

**Capacidades indispensáveis para nível enterprise**
- Confirmação atômica + cabeçalho de lote obrigatório.
- Workflow com fechamento assinado + aprovação.
- Trilha WORM + timeline por transação.
- Motor único de matching com score decomposto e explicável.
- Adapters plugáveis + processamento em fila.
- KPIs operacionais + dashboard book-to-bank.
- LGPD by design.

**Maior ROI (curto prazo)**
- Confirmação atômica (elimina inconsistências).
- Fechamento formal (compliance).
- UI de matching para CSV/PDF (elimina fluxo paralelo).
- Índices + virtualização (10-100× performance).
- Quick wins de segurança (DELETE restrito, motivo em desfazer).

**Melhorias que devem anteceder qualquer expansão**
1. Confirmação atômica + cabeçalho obrigatório (F22/F23).
2. Motor único de matching (F4).
3. Modelo canônico único (F3).
4. Fila/worker + observabilidade (base para volume).
5. Trilha WORM + fechamento (base para Open Finance/CNAB e
   integrações downstream).
