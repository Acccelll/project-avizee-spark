# Go Live Checklist — Conciliação Financeira
> Etapa 14 — Partes 13 e 14

## Legenda
✅ Obrigatório atendido · 🟡 Recomendado · 🔴 Bloqueador se não atendido

## Parte A — Critérios Obrigatórios (Go)
- [ ] ✅ Todos os testes automatizados aprovados na branch de release
- [ ] ✅ Sem bugs P0/P1 abertos no board
- [ ] ✅ Sem regressões nas suítes de conciliação, importação e matching
- [ ] ✅ Performance validada conforme SLOs (p95 < 1.2s)
- [ ] ✅ Revisão de segurança aprovada (RLS, RBAC, Vault, CORS)
- [ ] ✅ Auditoria (`audit_log`) validada com casos de teste
- [ ] ✅ Procedimento de rollback validado em staging
- [ ] ✅ Documentação (Etapas 1–13) publicada e revisada
- [ ] ✅ Quality Gates aprovados para todas as Features do escopo
- [ ] ✅ Definition of Ready respeitada em todas as Sprints
- [ ] ✅ MASTER-DECISIONS atualizado
- [ ] ✅ IMPLEMENTATION-JOURNAL atualizado até a última Sprint
- [ ] ✅ `CRON_SECRET` configurado em produção
- [ ] ✅ Backups PITR ativos e restore testado
- [ ] ✅ Monitoramento e alertas ativos (dashboard mínimo)
- [ ] ✅ Runbooks acessíveis à equipe on-call
- [ ] ✅ Comunicação de Go Live enviada aos stakeholders
- [ ] ✅ Janela de manutenção acordada

## Parte B — Critérios de No Go (Bloqueadores)
- [ ] 🔴 Falha de integridade financeira detectada
- [ ] 🔴 Perda de rastreabilidade em auditoria
- [ ] 🔴 Performance crítica fora do SLO em staging
- [ ] 🔴 Segurança comprometida (RLS ausente, secret vazado)
- [ ] 🔴 Auditoria não funcional
- [ ] 🔴 Rollback inexistente ou não testado
- [ ] 🔴 Documentação crítica incompleta
- [ ] 🔴 Dependência externa desconhecida
- [ ] 🔴 Débito técnico crítico não mitigado

## Parte C — Pós-Corte (D+0)
- [ ] Health check em todas as Edge Functions
- [ ] Sanidade de matching em 3 lotes reais
- [ ] Verificação de logs por 2h
- [ ] Confirmação de KPIs mínimos
