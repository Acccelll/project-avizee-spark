# Pré-Implementation Checklist — Conciliação

Checklist consolidado por área. Use em conjunto com `DOR-CHECKLIST.md`.

## Arquitetura

- [ ] Aderência ao TO-BE e ADRs verificada
- [ ] Feature flag por empresa definida
- [ ] Contratos de portas/adaptadores definidos

## Banco

- [ ] Migrations planejadas e revisadas
- [ ] `GRANT` explícito para roles alinhados às policies
- [ ] RLS habilitada e políticas definidas
- [ ] `chk_` constraints para domínios
- [ ] Rollback idempotente
- [ ] Backup / snapshot pré-deploy

## Backend

- [ ] RPCs `SECURITY DEFINER` + `search_path = public`
- [ ] Idempotência por `operation_id`
- [ ] Eventos publicados no Outbox
- [ ] Tratamento de erros padronizado
- [ ] Logs estruturados via `logger.ts`

## Edge Functions / APIs

- [ ] CORS configurado
- [ ] Validação Zod dos inputs
- [ ] Timeout e retry documentados
- [ ] Sem segredos em código

## Frontend

- [ ] Sem hardcode de cor (design tokens)
- [ ] `useSupabaseCrud` paginado
- [ ] Empty/Loading padronizados (QueryState)
- [ ] Acessibilidade básica

## Hooks / Stores / Serviços

- [ ] Responsabilidade única
- [ ] Sem lógica de negócio na UI
- [ ] Tipagem em `src/types/domain.ts`

## Integrações

- [ ] Contrato registrado
- [ ] Fallback / timeout definidos
- [ ] Observabilidade prevista

## Permissões

- [ ] RBAC via `can(resource, action)`
- [ ] SoD respeitada
- [ ] Auditoria de alterações críticas

## Logs / Observabilidade

- [ ] `operation_id`, `empresa_id`, domínio
- [ ] Sem PII
- [ ] Métricas técnicas e de negócio previstas
- [ ] Alertas configurados

## Testes

- [ ] Unit / Integração / E2E mapeados
- [ ] Dataset canônico atualizado
- [ ] Regressão financeira verde
- [ ] Testes de segurança RLS/SoD

## Documentação

- [ ] Blueprint, ADR, runbook, diagramas atualizados
- [ ] Rastreabilidade em `TRACEABILITY-MATRIX.md`
