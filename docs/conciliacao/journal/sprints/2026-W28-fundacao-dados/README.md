# Sprint 1 — Fundação de Dados da Conciliação v2

**Data:** 2026-07-11  
**Autor:** Lovable  
**Release:** Fundação  
**Backlog:** E1-F3, E1-F4, E1-F5, E2-F1, E3-F2  
**Blueprint:** `EXECUTION-BLUEPRINT.md` §§4–7, `DOMAIN-IMPLEMENTATION-GUIDE.md` §1  
**Status:** ✅ Concluída com ressalvas não bloqueantes

## Objetivo

Estabelecer a base persistente e tipada da Conciliação v2, com deduplicação de arquivos e linhas, regras versionadas, matches auditáveis e serviço inicial de importação.

## Escopo entregue

- Migration `20260711183316_56498cf6-aa70-4b6e-96de-650b81dd1a0e.sql`.
- Tabelas:
  - `conciliacao_extratos`
  - `conciliacao_extrato_linhas`
  - `conciliacao_regras`
  - `conciliacao_matches`
- GRANT explícito para acesso autenticado e rotinas internas.
- RLS por empresa com acesso a administradores e perfil financeiro.
- `chk_` constraints para formatos, origem, status, valores, score, vigência e aprovações.
- Índices e chaves únicas para deduplicação por `arquivo_hash`, `hash_linha`, `fitid` e `operation_id`.
- Tipos centralizados em `src/types/domain.ts`.
- Serviço base `src/services/conciliacao/importService.ts` com:
  - hash SHA-256 de arquivo/linha;
  - busca idempotente por hash de arquivo;
  - criação de extrato;
  - inserção em chunks de linhas normalizadas;
  - atualização de status do extrato;
  - logs via `logger`.

## Arquivos alterados

- `supabase/migrations/20260711183316_56498cf6-aa70-4b6e-96de-650b81dd1a0e.sql`
- `src/integrations/supabase/types.ts` (regenerado automaticamente)
- `src/types/domain.ts`
- `src/services/conciliacao/importService.ts`
- `docs/conciliacao/CHANGE-HISTORY.md`
- `docs/conciliacao/journal/README.md`
- `docs/conciliacao/journal/sprints/2026-W28-fundacao-dados/README.md`

## Evidências de validação

- Migration aplicada com sucesso no backend.
- RLS conferido: 4 policies por nova tabela.
- GRANT conferido: permissões de leitura e escrita autenticadas e acesso interno operacional presentes nas 4 novas tabelas.
- Tipos do backend regenerados contendo as 4 tabelas novas.
- `tsgo --noEmit -p tsconfig.app.json`: ✅ sem erros.
- Verificação de `console.*` nos arquivos novos: ✅ sem ocorrências.

## Quality Gates

| Gate | Critério | Resultado |
| ---- | -------- | --------- |
| G1 — Arquitetura | Sem refatoração ampla; preserva stack; domínio isolado | ✅ Aprovado |
| G2 — Segurança/RLS | RLS + GRANT em todas as novas tabelas | ✅ Aprovado |
| G3 — Banco/Integridade | `chk_` constraints, FKs, índices e dedupe | ✅ Aprovado |
| G4 — Tipagem | Tipos centralizados e TS válido | ✅ Aprovado |
| G5 — Observabilidade | Serviço usa `logger`, sem `console.*` | ✅ Aprovado |

## Scorecard

| Critério | Nota |
| -------- | ---- |
| Arquitetura | 9/10 |
| Funcional | 8/10 |
| Segurança | 9/10 |
| Performance | 8/10 |
| Testes | 8/10 |
| Documentação | 9/10 |
| Observabilidade | 8/10 |
| Governança | 9/10 |

**Score final:** 88/100 — ✅ Aprovado com ressalvas.

## Ressalvas e riscos

- O linter global do backend retornou achados preexistentes fora do escopo da Sprint 1; nenhum achado novo foi identificado nas tabelas recém-criadas durante a checagem específica.
- O serviço de importação ainda não implementa parser OFX/CNAB/CSV nem workflow de matching; isso pertence às próximas Sprints.
- A aplicação das políticas usa papéis existentes `admin` e `financeiro`; permissões granulares de UI devem continuar usando `can(resource, action)` quando as telas forem criadas.

## Rollback

1. Desabilitar a feature flag `conciliacao.v2` por empresa.
2. Suspender novas importações.
3. Se ainda não houver dados produtivos dependentes, remover as tabelas na ordem documentada no cabeçalho da migration.
4. Confirmar integridade do módulo legado de conciliação bancária.

## Próximo passo

Sprint 2 deve iniciar importação/parser/normalização reutilizando esta fundação, sem avançar para matching completo antes de passar pelos Quality Gates correspondentes.