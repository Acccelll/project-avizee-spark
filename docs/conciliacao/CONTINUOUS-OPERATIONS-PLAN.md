# Continuous Operations Plan
> Etapa 14 — Partes 19, 21, 22

## 1. Roadmap Pós-Produção (Parte 19)
### 30 dias — Estabilização
- Fechar pendências P1/P2 do PRR.
- Habilitar HIBP.
- Dashboards operacionais completos.
- Alertas automatizados.

### 90 dias — Otimização
- Otimização de índices e consultas top-10.
- Revisão do motor de matching (regras + score).
- Introdução de cache seletivo.
- Automação de sweep de workflow.

### 6 meses — Evolução
- Particionamento lógico para volumes > 5M.
- Melhoria de UX na tela de conciliação em lote.
- Ampliação de conectores de importação.

### 12 meses — Inovação
- Sugestão de matching assistida por IA (Lovable AI Gateway).
- Automação de conciliação recorrente.
- Analytics avançado (SLIs históricos, forecast).

## 2. Operação Contínua (Parte 21)
| Processo | Periodicidade | Responsável | Indicador |
|---|---|---|---|
| Gestão de capacidade | Mensal | SRE | CPU/mem/DB conn |
| Gestão de mudanças | Contínua | Tech Lead | CAB semanal |
| Gestão de problemas | Contínua | SRE | Recorrência de INC |
| Gestão de incidentes | Contínua | On-call | MTTR/MTTA |
| Gestão de versões | Por release | PO | Frequência de deploy |
| Revisão de arquitetura | Trimestral | Chief Architect | ADRs revisados |
| Revisão de segurança | Trimestral | DevSecOps | Findings abertos |
| Revisão de performance | Mensal | SRE | p95/p99 |
| Qualidade de dados | Mensal | Financeiro | Divergências |
| Auditoria financeira | Trimestral | Auditoria | Não conformidades |
| Revisão motor matching | Semestral | Tech Lead | Taxa auto ≥ 85% |
| Revisão regras negócio | Semestral | PO + Financeiro | ADRs atualizados |

## 3. Evolução Contínua (Parte 22)
- **Novas funcionalidades**: passam por DoR → Blueprint → Quality Gates → Journal.
- **Revisão de ADRs**: trimestral; ADR obsoleta é marcada `Superseded`.
- **MASTER-DECISIONS**: atualizado em cada decisão relevante; PR obrigatório.
- **EXECUTION-BLUEPRINT**: atualizado a cada Epic novo.
- **Dívida técnica**: TECHNICAL-DEBT-REGISTER revisado mensalmente; 20% da capacidade da Sprint reservada.
- **KPIs**: revisados trimestralmente com stakeholders.
- **Maturidade**: score aferido no final de cada Release (referência: PRR).
- **Aderência a TOTVS/ERPs de referência**: benchmark semestral documentado.

## 4. Cadência
- Daily de operação (15 min) — primeiros 30 dias.
- Weekly review — permanente.
- Monthly Business Review — permanente.
- Quarterly Architecture Review — permanente.
