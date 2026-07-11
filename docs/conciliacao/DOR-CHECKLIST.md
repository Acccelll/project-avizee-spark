# DoR Checklist — Sprint / Epic / Feature / Prompt

Preencher e anexar antes de liberar qualquer item para implementação. Um "não" em qualquer eliminatório bloqueia a liberação.

## Identificação

- [ ] ID e nome do item
- [ ] Tipo (Sprint / Epic / Feature / Prompt)
- [ ] Domínio afetado
- [ ] Responsáveis (PO, Arquiteto, Tech Lead, QA, Dev)

## Negócio

- [ ] Objetivo claro e mensurável
- [ ] Problema definido
- [ ] Benefício esperado
- [ ] Escopo fechado
- [ ] Stakeholders identificados

## Arquitetura (eliminatório)

- [ ] Aderente ao TO-BE
- [ ] ADR referenciado (ou novo ADR criado)
- [ ] Domínio e responsabilidades definidos
- [ ] Dependências arquiteturais listadas

## Banco (eliminatório quando aplicável)

- [ ] Impacto identificado
- [ ] Entidades conhecidas
- [ ] Estratégia de migração definida
- [ ] Rollback definido

## Backend

- [ ] Serviços definidos
- [ ] Casos de uso definidos
- [ ] Eventos e contratos definidos
- [ ] Integrações identificadas

## Frontend

- [ ] Telas identificadas
- [ ] Componentes/hooks/stores definidos
- [ ] Fluxos mapeados

## Testes (eliminatório)

- [ ] Plano de testes
- [ ] Critérios de aceite mensuráveis
- [ ] Cenários críticos e regressão

## Segurança

- [ ] Permissões (RBAC/RLS/SoD)
- [ ] Auditoria prevista
- [ ] Riscos identificados

## Rollback (eliminatório)

- [ ] Procedimento definido
- [ ] Preservação de dados garantida
- [ ] Validação pós-rollback

## Documentação

- [ ] Blueprint atualizado
- [ ] Rastreabilidade preenchida
- [ ] Runbook e ADR revisados

## Prompt (quando aplicável)

- [ ] Aprovado no `PROMPT-READINESS-GUIDE.md`

## Aprovação

- [ ] Score ≥ 85 (`SPRINT-READINESS-SCORECARD.md`)
- [ ] Sem itens eliminatórios em aberto
- [ ] Assinatura: PO ___ · Arquiteto ___ · Tech Lead ___ · QA ___
