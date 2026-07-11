# Quality Checklist — Feature / Sprint / Epic / Release / Go Live

Marcar todos os itens aplicáveis. Qualquer eliminatório em aberto reprova a etapa.

## Comum a todos os níveis

- [ ] Aderência ao TO-BE e ADRs (eliminatório)
- [ ] Rastreabilidade atualizada (`TRACEABILITY-MATRIX.md`)
- [ ] Blueprint e docs atualizados (eliminatório)
- [ ] Logs estruturados, sem PII
- [ ] RLS + GRANT + SoD validados (eliminatório)
- [ ] Rollback documentado e testado (eliminatório)
- [ ] Evidências anexadas (Parte 15)

## Feature

- [ ] Critérios de aceite atendidos
- [ ] Unit + integração verdes
- [ ] Sem código morto / duplicação
- [ ] Score ≥ 80

## Sprint

- [ ] Regressão financeira verde
- [ ] E2E do escopo verde
- [ ] Observabilidade ativa
- [ ] Runbook parcial disponível
- [ ] Score ≥ 85

## Epic

- [ ] Fluxos consolidados
- [ ] KPIs do domínio publicando
- [ ] Auditoria cruzada sem divergência (Parte 22)
- [ ] Score ≥ 88

## Release

- [ ] Dataset canônico completo verde
- [ ] Testes de carga no volume-alvo
- [ ] Segurança revisada
- [ ] Runbook completo
- [ ] Score ≥ 90

## Go Live

- [ ] Checklist final aprovado
- [ ] Monitoramento e alertas ativos
- [ ] Rollback ensaiado
- [ ] Comunicação enviada
- [ ] Score ≥ 92
- [ ] Assinatura: PO ___ · Arquiteto ___ · Tech Lead ___ · QA ___ · CQO ___
