# ADR-016 · Migração strangler por operação (não big-bang)

**Status**: Aceito · **Data**: 2026-07-13 · **Etapa**: 2

## Contexto
Trocar tudo de uma vez põe emissão fiscal em risco. Trocar parcial exige coexistência.

## Decisão
Feature flags `fiscal:v2:{operacao}` decidem entre novo framework e legacy por request. Migração operação por operação (autorizacao → cancel → cce → inutil → manif → distdfe). Corte final em Etapa 9 com 60d de coexistência.

## Consequências
- **+** Rollback isolado por operação.
- **+** Coexistência viabiliza validação em produção sem risco.
- **−** Duplicidade temporária de código — aceitável até Etapa 9.