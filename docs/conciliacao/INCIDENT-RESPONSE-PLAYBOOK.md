# Incident Response Playbook
> Etapa 14 — Parte 16 (aprofundado)

## 1. Severidade
| Nível | Definição | SLA Resposta | SLA Resolução |
|---|---|---|---|
| P0 | Parada total, perda financeira, vazamento | 5 min | 4h |
| P1 | Função crítica degradada | 15 min | 8h |
| P2 | Impacto parcial, contornável | 1h | 3 dias |
| P3 | Cosmético, sem impacto | 1 dia | Backlog |

## 2. Fluxo
1. **Detecção** — alerta, usuário, monitoramento.
2. **Triagem** — SRE on-call classifica severidade.
3. **Contenção** — feature-flag off, rollback, isolar tenant.
4. **Diagnóstico** — logs, tracing, métricas.
5. **Correção** — hotfix ou workaround.
6. **Comunicação** — atualizações a cada 30min (P0) / 1h (P1).
7. **Recuperação** — validar KPIs, encerrar incidente.
8. **Pós-mortem** — blameless, 5 dias úteis, publicado em `docs/conciliacao/postmortems/`.
9. **Ações preventivas** — inseridas em TECHNICAL-DEBT-REGISTER e RISK-REGISTER.

## 3. Comunicação
- Canal interno: `#incidentes-avizee`.
- Stakeholders externos: e-mail padronizado por severidade.
- Status page interna atualizada em P0/P1.

## 4. Modelo de Registro
```
ID: INC-YYYYMMDD-NN
Severidade: P?
Início: hh:mm
Detecção: hh:mm
Contenção: hh:mm
Resolução: hh:mm
Componentes: ...
Impacto: ...
Causa raiz: ...
Ações corretivas: ...
Ações preventivas: ...
Responsáveis: ...
```

## 5. Escalonamento
On-call → Tech Lead → CTO → Diretoria (apenas P0 > 2h ou impacto financeiro).

## 6. Lições Aprendidas
Item obrigatório do pós-mortem, revisado em Monthly Business Review.
