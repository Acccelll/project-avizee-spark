# ADR-013 · Contingência SEFAZ nunca ativada automaticamente

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
Automatizar contingência (SVC-AN, EPEC) tem consequência fiscal: notas emitidas em modo errado precisam ser regularizadas manualmente. Falsos positivos custam caro.

## Decisão
`fiscal-contingency-manager` apenas **sugere**; ativação exige `fiscal:admin` explícito. Encerramento também manual.

## Consequências
- **+** Sem emissão inadvertida em contingência.
- **−** Requer operador vigilante — mitigado por alerta crítico + notificação.