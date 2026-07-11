# REQUISITOS — PRÓXIMA GERAÇÃO DA CONCILIAÇÃO

> Consolidação de requisitos funcionais e não funcionais que devem
> orientar o redesenho da arquitetura na Etapa 5. Sem propostas de
> implementação, sem definição de tecnologia. Prioridades alinhadas
> à `MATRIZ-DE-PRIORIZACAO.md`.

---

## 1. Requisitos Funcionais

### RF-01 Captura multi-canal (adapters plugáveis)
- **Objetivo**: ingerir extratos de OFX/QFX, CSV, PDF (OCR), CNAB240,
  CNAB400, API bancária direta e Open Finance BCB.
- **Problema resolvido**: dependência de OFX manual e regex por banco.
- **Benefício**: cobertura ampla, redução de atraso, escala.
- **Prioridade**: P1 · **Dependências**: RF-03 (canônico), RF-16
  (fila/worker).

### RF-02 Deduplicação por hash e fingerprint
- **Objetivo**: bloquear reimport idêntico e detectar duplicidade a
  nível de transação (banco+agência+conta+valor+data+documento).
- **Benefício**: elimina duplo pagamento; base de auditoria.
- **Prioridade**: P0 · **Dependências**: RF-03.

### RF-03 Modelo canônico único da transação
- **Objetivo**: representação única para todos os canais.
- **Benefício**: base uniforme para regras, matching, ML, KPIs e
  auditoria.
- **Prioridade**: P1 · **Dependências**: —.

### RF-04 Engine de matching unificada
- **Objetivo**: eliminar coexistência legado × Motor Universal; uma
  engine determinística+probabilística com pesos configuráveis.
- **Benefício**: fim da dupla verdade; thresholds coerentes.
- **Prioridade**: P1 · **Dependências**: RF-03, RF-07.

### RF-05 Cardinalidades N×1 / 1×N (com trilha)
- **Objetivo**: casar múltiplos títulos com um extrato e vice-versa,
  persistindo o grupo.
- **Benefício**: cobre PIX agregado, TED consolidado, boletos
  agrupados.
- **Prioridade**: P2 · **Dependências**: RF-04.

### RF-06 Matching N×N (rebateio parcial)
- **Objetivo**: split de valor entre extratos e títulos.
- **Prioridade**: P3 · **Dependências**: RF-05.

### RF-07 Score decomposto e explicável
- **Objetivo**: mostrar breakdown por dimensão (valor, data, doc,
  contraparte, natureza, histórico).
- **Benefício**: confiança e treinamento do operador.
- **Prioridade**: P2 · **Dependências**: RF-04.

### RF-08 Configuração por empresa/conta (thresholds/tolerâncias)
- **Objetivo**: personalizar apetite ao risco.
- **Prioridade**: P2 · **Dependências**: RF-04.

### RF-09 Motor de regras com versionamento e dry-run
- **Objetivo**: regras versionadas (autor/motivo/vigência) e
  simulação antes de ativar.
- **Benefício**: segurança para evoluir regras críticas.
- **Prioridade**: P2 · **Dependências**: RF-19 (auditoria).

### RF-10 Aliases com TTL e histórico
- **Objetivo**: expirar aliases e permitir reversão.
- **Prioridade**: P2 · **Dependências**: RF-09.

### RF-11 Recomendação automática de regra a partir de padrões
- **Objetivo**: sugerir novas regras quando o histórico mostrar
  repetição.
- **Prioridade**: P2 · **Dependências**: RF-09, RF-04.

### RF-12 Workflow completo com estados discretos
- **Objetivo**: Pendente → Sugerido → Em revisão → Conciliado →
  Baixado → Auditado → Fechado, com Ajuste/Divergência e
  Rejeição reabrível.
- **Benefício**: SLA, aprovação, fechamento.
- **Prioridade**: P1 · **Dependências**: RF-14, RF-15.

### RF-13 Fila de exceções com SLA
- **Objetivo**: backlog visível por idade/valor/motivo.
- **Prioridade**: P2 · **Dependências**: RF-12.

### RF-14 Aprovação em dois níveis (maker/checker)
- **Objetivo**: aprovação obrigatória acima de limite configurável.
- **Prioridade**: P1 · **Dependências**: RF-12, RF-19.

### RF-15 Fechamento por conta/período com assinatura
- **Objetivo**: bloqueio de mutação retroativa; assinatura de auditor.
- **Prioridade**: P0 · **Dependências**: RF-12, RF-19.

### RF-16 Ajuste contabilizável de divergência
- **Objetivo**: centro de custo "ajuste" + motivo obrigatório.
- **Prioridade**: P2 · **Dependências**: RF-12.

### RF-17 Detecção de transferências internas (robusta)
- **Objetivo**: identificação D↔C entre contas próprias, reversível.
- **Prioridade**: P2 · **Dependências**: RF-03.

### RF-18 Detecção de anomalias e duplicidade cruzada
- **Objetivo**: alertar duplo pagamento entre contas, valores
  atípicos, favorecido alterado.
- **Prioridade**: P2 · **Dependências**: RF-03.

### RF-19 Sessão de conciliação persistida (draft)
- **Objetivo**: retomada, colaboração e trilha de tentativas.
- **Prioridade**: P2 · **Dependências**: RF-12.

### RF-20 Reabertura assistida de sugestões rejeitadas
- **Objetivo**: UI + trilha para reativar par bloqueado.
- **Prioridade**: P2 · **Dependências**: RF-19.

### RF-21 UI de matching para todos os canais
- **Objetivo**: CSV/PDF/CNAB/API entram no mesmo painel do OFX.
- **Prioridade**: P1 · **Dependências**: RF-01, RF-03.

### RF-22 Confirmação transacional atômica
- **Objetivo**: baixa + conciliação + livro em uma unidade (RPC
  única ou saga com compensação).
- **Prioridade**: P0 · **Dependências**: RF-23.

### RF-23 Livro de conciliação obrigatório (`conciliacao_bancaria`)
- **Objetivo**: cabeçalho + pares obrigatórios em todo lote.
- **Prioridade**: P0 · **Dependências**: —.

### RF-24 Bloqueio de período fechado
- **Objetivo**: impedir conciliação em mês fechado
  (`fechamentos_mensais`).
- **Prioridade**: P0 · **Dependências**: RF-15.

### RF-25 Motivo obrigatório em desfazer/estornar/rejeitar
- **Objetivo**: campo motivo + trilha em todas as ações reversíveis.
- **Prioridade**: P0 · **Dependências**: RF-19.

### RF-26 KPIs operacionais
- **Objetivo**: % conciliado, % automático, tempo médio, exceções
  por idade, precisão do matching, retrabalho, cobertura por banco.
- **Prioridade**: P2 · **Dependências**: RNF-06.

### RF-27 Visão book-to-bank
- **Objetivo**: saldo inicial + movimentos + saldo final × banco.
- **Prioridade**: P2 · **Dependências**: RF-15, RF-26.

### RF-28 Timeline por transação
- **Objetivo**: histórico visível (quem viu, sugeriu, aprovou,
  reverteu).
- **Prioridade**: P2 · **Dependências**: RF-19.

### RF-29 Bulk actions com preview de impacto
- **Objetivo**: aceitar/rejeitar/ignorar/reabrir em lote com resumo
  financeiro antes de confirmar.
- **Prioridade**: P2 · **Dependências**: RF-12.

### RF-30 Explainable AI ao lado da sugestão
- **Objetivo**: motivos visíveis para cada match.
- **Prioridade**: P2 · **Dependências**: RF-07.

### RF-31 Mascaramento de PII (LGPD)
- **Objetivo**: mascarar CPF/CNPJ e nomes em logs, IA e exportações.
- **Prioridade**: P2 · **Dependências**: RNF-05.

### RF-32 Assinatura hash do fechamento
- **Objetivo**: hash + assinatura do auditor no fechamento.
- **Prioridade**: P3 · **Dependências**: RF-15.

### RF-33 Adapter plugável por banco/canal
- **Objetivo**: registrar novos bancos/canais via plugin sem alterar
  núcleo.
- **Prioridade**: P2 · **Dependências**: RF-01, RF-03.

### RF-34 Event bus downstream (contábil/BI/Notificações)
- **Objetivo**: publicar eventos (`extrato.recebido`,
  `match.sugerido`, `conciliacao.confirmada`, `periodo.fechado`).
- **Prioridade**: P2 · **Dependências**: RF-22.

### RF-35 Multi-conta em um único arquivo OFX
- **Objetivo**: rejeitar ou distribuir por `BANKACCTID`.
- **Prioridade**: P0 · **Dependências**: RF-01, RF-03.

### RF-36 Preview do arquivo antes de gravar
- **Prioridade**: P3 · **Dependências**: RF-01.

### RF-37 Drag-and-drop múltiplo + fila de importação
- **Prioridade**: P3 · **Dependências**: RF-16 (fila), RF-01.

### RF-38 Atalhos de teclado no workbench
- **Prioridade**: P3 · **Dependências**: RF-12.

### RF-39 Import/export CSV/JSON de regras e aliases
- **Prioridade**: P3 · **Dependências**: RF-09.

### RF-40 Alertas inteligentes (extrato faltando, SLA estourado)
- **Prioridade**: P2 · **Dependências**: RF-13, RF-34.

### RF-41 Relatório PDF/CSV de conciliação para auditoria externa
- **Prioridade**: P2 · **Dependências**: RF-15, RF-19.

### RF-42 Simulação "se aceitar todas ≥ X"
- **Prioridade**: P3 · **Dependências**: RF-07, RF-29.

---

## 2. Requisitos Não Funcionais

### RNF-01 Desempenho
- Painéis com até 100k linhas: filtragem/scroll subsegundo.
- Confirmação de lote (100 pares) em ≤ 3s p95.
- Parse/score de arquivos > 10 MB fora da UI thread.

### RNF-02 Disponibilidade
- SLO 99,5% mensal para o módulo.
- Degradação graceful se IA/Motor cair (fallback para modo manual).

### RNF-03 Escalabilidade
- Suportar 1M de extratos e 1M de lançamentos por empresa/ano
  ativos, com plano de particionamento/archive.
- Adicionar novo canal (adapter) sem alterar núcleo.

### RNF-04 Observabilidade
- Logs estruturados com correlação (`trace_id`,
  `empresa_id`, `usuario_id`).
- Métricas: throughput, latência, taxa de erro, precisão do matching.
- Tracing de fim-a-fim para importação e confirmação.

### RNF-05 Segurança e LGPD
- RLS por empresa; segregação de funções (importar × conciliar ×
  aprovar × auditar).
- Mascaramento de PII em logs, IA e exportações.
- Rate-limit client + server.
- Restrição de DELETE em tabelas transacionais.
- Assinatura hash de arquivos e fechamentos.

### RNF-06 Rastreabilidade
- Trilha append-only (WORM) para eventos críticos.
- Snapshot antes/depois em conciliação, ajuste e estorno.
- Correlação usuário↔sessão↔IP↔empresa↔transação.

### RNF-07 Manutenibilidade
- Hooks decompostos por responsabilidade; componentes ≤ 300 LoC.
- Tipos centralizados em `src/types/domain.ts`.
- Zero `console.*`; `logger.*` padronizado.
- Documentação viva no CI (docs versionados com o código).

### RNF-08 Extensibilidade
- Plugin registry para adapters de captura.
- Regras versionadas e configuráveis por empresa.
- Thresholds e tolerâncias por empresa/conta.

### RNF-09 Testabilidade
- Engines puras (matching/regras) 100% cobertas por unit tests.
- Fluxo de confirmação com teste de integração.
- E2E cobrindo caminhos: OFX, CSV, desfazer, aprovação, fechamento.

### RNF-10 Confiabilidade
- Idempotência em todas as escritas com chave natural.
- Retry com jitter em integrações externas.
- Saga com compensação para operações multi-passo.
- Falhas nunca engolidas; sempre propagadas com contexto.

### RNF-11 Acessibilidade
- WCAG AA no workbench.
- Foco visível, contraste adequado, navegação por teclado.

### RNF-12 Governança e Compliance
- Fechamento formal por conta/período com assinatura.
- Política de retenção e exportação para auditoria externa.
- Versionamento de regras/aliases/thresholds com autor/motivo.
- Aprovação em dois níveis obrigatória acima de limite.

---

## 3. Mapa de dependências (alto nível)

```
RF-03 (canônico) ─┬─ RF-01 (captura)
                  ├─ RF-04 (matching) ─── RF-05/06/07/08/11
                  ├─ RF-17 (transf.)
                  ├─ RF-18 (anomalias)
                  ├─ RF-33 (adapters)
                  └─ RF-35 (multi-conta)

RF-23 (livro) ─── RF-22 (atômico) ─── RF-34 (eventos)

RF-12 (workflow) ─┬─ RF-13 (fila)
                  ├─ RF-14 (aprovação)
                  ├─ RF-15 (fechamento) ─ RF-24 (bloqueio) / RF-32
                  ├─ RF-16 (ajuste)
                  ├─ RF-19 (draft) ─── RF-20/28
                  ├─ RF-25 (motivo)
                  └─ RF-29 (bulk)

RF-09 (regras) ─── RF-10 (TTL) / RF-11 (recomendação) / RF-39

RNF-06 (WORM) → sustenta RF-14/15/19/25/28
RNF-04 (observabilidade) → sustenta RF-13/26/40
```

Estes vínculos servem de guia para a Etapa 5 (arquitetura TO-BE).
