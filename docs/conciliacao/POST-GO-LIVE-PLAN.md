# Post Go Live Plan — Operação Assistida
> Etapa 14 — Parte 12

## Horizonte 24 horas (D+0 → D+1)
- Monitoramento contínuo do dashboard operacional.
- On-call dedicado (SRE + Tech Lead + DBA em standby).
- Verificação horária de: fila, matching, erros, latência.
- Reunião de checkpoint a cada 4h.
- Critério de sucesso: zero incidentes P0; ≤ 2 incidentes P1 resolvidos < 1h.
- Critério de alerta: qualquer P0 → acionar rollback parcial.

## Horizonte 7 dias (D+1 → D+7)
- Daily de operação (15min).
- KPIs monitorados: taxa matching, tempo médio conciliação, erros/import.
- Ajuste fino de índices e caches conforme `slow_queries`.
- Revisão diária de logs Edge.
- Critério de sucesso: KPIs dentro do SLO por 5 dias consecutivos.

## Horizonte 30 dias
- Weekly review (Tech Lead + PO + SRE).
- Fechamento das ações P1/P2 do PRODUCTION-READINESS-REPORT.
- Ativação de HIBP.
- Dashboards consolidados 100% operacionais.
- Teste de restore executado.
- Retrospectiva de Go Live e atualização do IMPLEMENTATION-JOURNAL.
- Critério de sucesso: score de maturidade ≥ 8.5.

## Horizonte 90 dias
- Monthly Business Review.
- Auditoria financeira independente (amostragem).
- Revisão de ADRs e MASTER-DECISIONS.
- Avaliação de escalabilidade (projeção de volume 6m).
- Encerramento formal do modo Operação Assistida.
- Critério de sucesso: SLA cumprido 3 meses consecutivos; nenhum P0 recorrente.

## Governança
- Responsáveis nomeados por horizonte.
- Reuniões registradas em `docs/conciliacao/journal/`.
- Métricas exportadas para o QUALITY-DASHBOARD.
