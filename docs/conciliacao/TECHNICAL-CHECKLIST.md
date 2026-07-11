# Technical Checklist — Conciliação

Checklist técnico obrigatório antes do início de qualquer domínio.

## Prontidão do Domínio

- [ ] Blueprint do domínio revisado (`DOMAIN-IMPLEMENTATION-GUIDE.md`).
- [ ] Dependências resolvidas (Fundação, Configurações, Auditoria transversal).
- [ ] Arquivos existentes classificados (reutilizar / adaptar / substituir / remover) com justificativa.
- [ ] Novos elementos listados (componentes, hooks, services, tabelas, eventos).
- [ ] Contratos de dados (Zod / SQL) definidos.
- [ ] RPCs e migrations previstas revisadas.
- [ ] RLS e políticas GRANT confirmadas.
- [ ] Feature flag por empresa preparada.

## Aceite

- [ ] Critérios de aceite objetivos e mensuráveis.
- [ ] Testes unitário, integração e e2e mapeados.
- [ ] Dataset canônico atualizado quando necessário.
- [ ] Testes de segurança (RLS/SoD) previstos.
- [ ] Testes de performance previstos quando aplicável.
- [ ] Regressão verificada nas suítes financeiras.

## Observabilidade

- [ ] Logs estruturados com `operation_id` e `empresa_id`.
- [ ] Eventos publicados no Outbox com idempotência.
- [ ] Métricas técnicas e de negócio previstas.
- [ ] Alertas configurados (cron_health, outbox, RPC).

## Rollback e Riscos

- [ ] Procedimento de rollback documentado (flag off + reversão idempotente).
- [ ] Riscos identificados com mitigação e contingência.
- [ ] Backup lógico / snapshot pré-deploy.
- [ ] Runbook de suporte disponível.

## Governança

- [ ] Rastreabilidade preenchida em `TRACEABILITY-MATRIX.md`.
- [ ] Responsabilidades atualizadas em `COMPONENT-RESPONSIBILITY-MATRIX.md`.
- [ ] ADRs referenciados.
- [ ] Documentação atualizada.

## Encerramento

- [ ] Todos os itens acima marcados.
- [ ] Aprovado por Tech Lead + Product Owner.
- [ ] Comunicado às áreas usuárias impactadas.
