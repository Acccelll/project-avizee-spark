# COMPARATIVO — PROJETO ATUAL × MELHORES PRÁTICAS DE ERPS

> Comparação entre `AviZee/Conciliação` (estado descrito em
> `CONCILIACAO-AS-IS.md` + gaps de `CONCILIACAO-GAPS.md`) e o
> conjunto de práticas descritas em `CONCILIACAO-BENCHMARK.md`.
> Sem propostas de implementação.
>
> Classificação: **Inexistente** · **Parcial** · **Completo** · **Pode
> melhorar**. Prioridade P0/P1/P2/P3 alinhada à
> `MATRIZ-PRIORIZACAO-CONCILIACAO.md`.

---

## 1. Captura / Ingestão

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Import OFX/QFX | Completo (parser local + Motor) | SAP FEBAN, NetSuite, QBO | — | — | — |
| Import CSV | Parcial (Motor Universal, sem UI de matching) | Todos | Fluxo assimétrico | Alto | P1 |
| Import PDF fatura | Parcial | QBO/Nibo (OCR + parse) | Cobertura limitada | Médio | P2 |
| CNAB240/CNAB400 | Inexistente | TOTVS RM, Protheus, Sankhya | Ausência total | Alto | P1 |
| API bancária direta | Inexistente | Dynamics + Data Providers, NetSuite Bank Feeds | — | Alto | P2 |
| Open Finance BCB | Inexistente | Conta Azul, Omie, Nibo | — | Alto | P2 |
| Drag-and-drop múltiplo + fila | Inexistente | Xero/QBO | UX manual | Médio | P3 |
| Deduplicação por hash de arquivo | Completo | Todos | — | — | — |
| Deduplicação por fingerprint transação | Parcial (só FITID) | SAP F.13, NetSuite | Perde em CSV/PDF | Alto | P1 |
| Preview antes de gravar | Inexistente | QBO Banking Review | Erros só após persistência | Médio | P3 |
| Multi-conta em um único arquivo | Inexistente | SAP, NetSuite | Risco de mistura | Alto | P0 |

## 2. Normalização

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Modelo canônico | Parcial (`TransacaoCanonica` + `StagedTx`) | Único modelo | Duas representações | Médio | P2 |
| Extratores por banco | Parcial (regex Inter/PIX/MP) | SAP BAdI plugável | Difícil evoluir | Médio | P2 |
| Enriquecimento por documento | Parcial | Todos | Baixa cobertura | Médio | P2 |
| Multi-moeda | Inexistente | SAP, Oracle, Dynamics | Sem câmbio | Baixo/local | P3 |

## 3. Regras / Aliases

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Alias exato | Completo | Todos | — | — | — |
| Regras substring/regex | Completo | Todos | — | — | — |
| Prioridade explícita | Parcial (numérica sem constraint) | Todos | Empate depende de id | Baixo | P3 |
| Versionamento de regra/alias | Inexistente | Xero, Dynamics | Sem histórico | Médio | P2 |
| Simulação (dry-run) | Inexistente | Nibo, QBO | Regras testadas em produção | Alto | P2 |
| Import/export CSV/JSON | Inexistente | Xero, Sankhya | Manutenção manual | Médio | P3 |
| Recomendação de nova regra | Inexistente | QBO, Nibo | Perde automação | Alto | P2 |
| TTL/expiração | Inexistente | Dynamics | Alias errado eterno | Médio | P2 |

## 4. Engine de matching

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| 1×1 | Completo | Todos | — | — | — |
| N×1 / 1×N | Parcial (checkbox UI) | SAP, Dynamics ABR | Sem persistência de grupos | Alto | P2 |
| N×N | Inexistente | SAP HANA, Oracle | Rebateio manual | Médio | P3 |
| Matching por identificador (boleto/PIX EndToEnd) | Inexistente | SAP FEBAN, NetSuite | Perde certeza máxima | Alto | P1 |
| Matching por CPF/CNPJ | Parcial (só Motor) | Todos | Não uniforme | Médio | P2 |
| Matching por banco/agência/conta | Parcial (transferências) | SAP, Dynamics | Cobertura limitada | Médio | P2 |
| Tolerância configurável | Parcial (constante) | Todos | Não por empresa | Médio | P2 |
| Duas engines coexistentes | Presente (legado + Motor) | Uma engine única | Dupla verdade | Alto | P1 |
| ML/embeddings | Inexistente | NetSuite AI, QBO | Cobertura probabilística baixa | Médio | P2 |
| Explicabilidade da sugestão | Parcial (só motivos internos) | Dynamics/NetSuite | UI não expõe | Médio | P2 |

## 5. Score / confiança

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Score contínuo [0,1] | Completo | Todos | — | — | — |
| Fórmula única | Inexistente (0,90 legado × 0,70 Motor × 0,50 IA) | Uma fórmula | Divergência | Alto | P1 |
| Thresholds por empresa | Inexistente | SAP, Dynamics | Rígido | Médio | P2 |
| Decomposição visível ao usuário | Parcial | Todos | UX baixa | Médio | P2 |
| Feedback afeta score futuro | Parcial (aliases) | Todos | Sem peso adaptativo por par | Médio | P2 |

## 6. Workflow

| Estado | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Pendente/Sugerido/Conciliado | Presente | Todos | — | — | — |
| Em revisão | Inexistente explicitamente | Todos | Sem fila | Alto | P2 |
| Ajuste/divergência | Parcial (`confirm()`) | Todos | Sem workflow | Alto | P1 |
| Aprovação (maker/checker) | Inexistente | SAP, Dynamics, Protheus | Risco compliance | Alto | P1 |
| Fechamento por conta/período | Inexistente | SAP F.13, Dynamics ABR | Mutação retroativa possível | Alto | P0 |
| Reabertura controlada | Parcial (desfazer) | Dynamics "Reopen" | Sem trilha | Médio | P2 |
| Rejeição reabrível | Inexistente | Todos | Irreversível | Médio | P2 |

## 7. Exceções

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Fila de exceções com SLA | Inexistente | SAP, Dynamics, NetSuite | Backlog invisível | Alto | P2 |
| Ajuste com centro de custo "ajuste" | Inexistente | SAP F.13 "Charge off" | Sem contabilização de diferença | Médio | P2 |
| Motivo obrigatório em desfazer | Inexistente | Todos | Auditoria fraca | Alto | P0 |
| Duplicidade cruzada (contas diferentes) | Inexistente | SAP HANA | Risco de duplo pagamento | Alto | P2 |
| Múltiplos candidatos com breakdown | Parcial | Dynamics/NetSuite | UI limitada | Médio | P2 |

## 8. Auditoria

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Trilha por evento | Parcial (`financeiro_auditoria`, mutável) | WORM | Sem imutabilidade | Alto | P2 |
| Timeline por transação | Inexistente | NetSuite record history | Diagnóstico difícil | Médio | P2 |
| Snapshot antes/depois | Inexistente | SAP change docs | Reconstituição limitada | Médio | P2 |
| Assinatura do arquivo importado | Completo (SHA-256) | — | — | — | — |
| Assinatura do fechamento | Inexistente | SAP, Protheus CTB | Sem prova de fechamento | Alto | P2 |
| Motivo em estorno | Inexistente | Todos | Compliance | Alto | P0 |

## 9. UX

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Split view extrato ↔ candidatos | Parcial (pane) | Dynamics/NetSuite/Xero | Sem breakdown lado a lado | Alto | P2 |
| Ações em lote com preview | Parcial (aceitar lote) | QBO, Xero | Sem preview de impacto | Médio | P2 |
| Atalhos de teclado | Inexistente | Xero, Nibo | Produtividade baixa | Médio | P3 |
| Drag-and-drop múltiplo | Inexistente | QBO, Xero | UX manual | Médio | P3 |
| Timeline lateral por transação | Inexistente | NetSuite | Diagnóstico difícil | Médio | P2 |
| Painel de exceções | Inexistente | QBO Banking Review | Backlog invisível | Alto | P2 |
| Dashboard operacional | Parcial (só aprendizado) | Todos | KPIs faltando | Alto | P2 |
| Onboarding contextual | Inexistente | QBO/Xero | Curva de aprendizado | Médio | P3 |
| Acessibilidade WCAG | Não verificado | SAP Fiori (AA) | Compliance | Médio | P3 |
| Visão book-to-bank | Inexistente | Todos | Fechamento cego | Alto | P2 |

## 10. Performance

| Aspecto | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Processamento em fila/worker | Inexistente | SAP Event Mesh, Dynamics batch | UI trava | Alto | P1 |
| Virtualização de listas | Inexistente | Todos | UX ruim em volume | Alto | P1 |
| Paginação server-side | Parcial | Todos | Consultas pesadas | Alto | P1 |
| Índices críticos | Parcial | Todos | N+1 possível | Alto | P1 |
| Materialized views para KPIs | Inexistente | SAP, NetSuite | Dashboard lento | Médio | P2 |
| Streaming de arquivos grandes | Inexistente | SAP | Memória alta | Médio | P2 |

## 11. Escalabilidade

| Dimensão | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Multi-empresa | Completo (RLS) | Todos | — | — | — |
| Multi-filial | Parcial | SAP, Dynamics | Sem contabilização por filial | Médio | P2 |
| Multi-moeda | Inexistente | SAP, Oracle | — | Baixo/local | P3 |
| Multi-gateway/adapter plugável | Inexistente | Todos | Novo banco = editar código | Médio | P2 |
| Event-driven downstream | Inexistente | SAP, Dynamics | Contábil/BI defasados | Médio | P2 |
| Particionamento/archive | Inexistente | SAP HANA | Crescimento sem controle | Médio | P1 |

## 12. Segurança

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| RLS por empresa | Completo | Todos | — | — | — |
| Papel `financeiro`/`admin` | Completo | Todos | — | — | — |
| Segregação (importar × conciliar × aprovar) | Inexistente | SAP GRC, Dynamics | Um papel faz tudo | Alto | P1 |
| Maker/checker acima de valor | Inexistente | SAP, Protheus | Risco fraude | Alto | P1 |
| Bloqueio de período fechado | Inexistente | Todos | Mutação retroativa | Alto | P0 |
| Detecção antifraude | Inexistente | SAP GRC, NetSuite | Sem alerta | Médio | P2 |
| Mascaramento PII em IA/logs | Inexistente | Todos (LGPD/GDPR) | Vazamento potencial | Alto | P2 |
| Assinatura digital de fechamento | Inexistente | SAP, Protheus | Sem prova legal | Médio | P3 |

## 13. KPIs

| KPI | Projeto Atual | ERP de Referência | GAP |
|---|---|---|---|
| % conciliado | Inexistente | Todos | Ausente |
| % automático × manual | Inexistente | Todos | Ausente |
| Tempo médio | Inexistente | Todos | Ausente |
| Divergências abertas | Inexistente | Todos | Ausente |
| Exceções por idade | Inexistente | Todos | Ausente |
| Precisão do matching | Parcial (só feedback) | Todos | Sem KPI operacional |
| Retrabalho (estornos) | Inexistente | Todos | Ausente |
| Cobertura por banco | Inexistente | Todos | Ausente |

## 14. Inteligência operacional

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Aprendizado (aliases) | Completo | QBO/Xero | — | — | — |
| Regras adaptativas | Parcial | QBO/Nibo | Sem peso adaptativo por par | Médio | P2 |
| Recomendação de nova regra | Inexistente | QBO/Nibo | Perde automação | Alto | P2 |
| Detecção de anomalias | Inexistente | SAP HANA, NetSuite | Sem alerta | Médio | P2 |
| Alertas inteligentes (SLA/extrato faltando) | Inexistente | Todos | Sem antecipação | Médio | P2 |
| Explainable AI | Parcial | Dynamics/NetSuite | UI limitada | Médio | P2 |
| Previsão de categorização | Inexistente | QBO | Sem automação de despesa direta | Médio | P2 |

## 15. Governança

| Funcionalidade | Projeto Atual | ERP de Referência | GAP | Impacto | Prioridade |
|---|---|---|---|---|---|
| Trilha | Parcial | WORM | Mutabilidade | Alto | P2 |
| LGPD by design | Parcial | Todos | PII em logs/IA | Alto | P2 |
| Segregação de funções | Inexistente | SAP GRC | Compliance | Alto | P1 |
| Controle de alterações em regras | Inexistente | Todos | Sem versão/autor | Médio | P2 |
| Retenção/exportação | Inexistente | Todos | Sem política | Médio | P3 |
| Integração GRC | Inexistente | SAP | Fora do escopo AviZee no curto prazo | Baixo | P3 |

---

## Panorama sintético

- **Cobertura básica**: capture OFX, aliases, sugestões, feedback,
  aprendizado — comparável a QBO/Xero em fluxos simples.
- **Distância crítica**: workflow completo, aprovação, fechamento,
  fila de exceções, auditoria WORM, engine unificada, adapters
  plugáveis, KPIs operacionais e inteligência (anomalias/recomendação
  de regra).
- **Riscos prioritários (P0)**: fechamento de período, motivo em
  estorno, multi-conta em OFX, transacionalidade da confirmação
  (já listado nos GAPs).
