# Prompt Readiness Guide — Claude / Lovable

Guia para validar qualquer prompt de implementação antes do envio.

## Critérios Obrigatórios

O prompt deve responder objetivamente:

- [ ] Possui contexto suficiente (domínio, arquitetura, ADRs relevantes)?
- [ ] Define objetivo claro?
- [ ] Limita o escopo (o que fazer e o que **não** fazer)?
- [ ] Define critérios de aceite mensuráveis?
- [ ] Define estratégia de rollback?
- [ ] Define atualização de documentação?
- [ ] Define plano de testes?
- [ ] Lista dependências resolvidas?
- [ ] Lista arquivos alvo (existentes, novos, modificados, removidos)?
- [ ] Identifica riscos e mitigações?

## Estrutura Recomendada

```text
1. Contexto (domínio + referências: TO-BE, ADR, Blueprint)
2. Objetivo
3. Escopo (in / out)
4. Arquivos alvo
5. Dependências
6. Critérios de aceite
7. Plano de testes
8. Rollback
9. Documentação a atualizar
10. Riscos e mitigações
11. Regras universais (sem @ts-nocheck; logger.ts; RLS; search_path; design tokens)
```

## Boas Práticas

- Referenciar documentos por nome exato (`CONCILIACAO-TO-BE.md`, `ADR-CONCILIACAO.md`).
- Preferir mudanças pequenas e reversíveis.
- Explicitar `operation_id` e idempotência quando houver escrita.
- Proibir decisões arquiteturais dentro do prompt; se surgir necessidade, interromper e abrir novo ADR.

## Anti-Padrões

- Prompt sem escopo ("melhore a conciliação").
- Ausência de rollback.
- Ausência de critérios de aceite mensuráveis.
- Referência a arquivos inexistentes.
- Mistura de múltiplos domínios em uma única execução.

## Aprovação

Um prompt só é enviado após checklist 100% marcado + assinatura do Tech Lead.
