# 05 — Manual do Desenvolvedor

## Estrutura do projeto
- Frontend: React 18 + Vite 5 + Tailwind + TS.
- Backend: Lovable Cloud (Supabase) — RLS obrigatório, GRANTs por tabela, RPCs com `search_path=public`.
- Framework Fiscal: `src/modules/fiscal/` (Clean Architecture, plugin architecture).

## Convenções
- Logging: `src/lib/logger.ts` — `console.*` proibido.
- Domain typing: interfaces em `src/types/domain.ts`.
- RBAC: `can(resource, action)` para ações críticas na UI.
- Idempotência: `Idempotency-Key` obrigatório nas edges de escrita (ADR-012).
- Eventos: sempre no passado (ADR-017), prefixados por módulo.

## Fluxo de desenvolvimento
1. Ler o ADR e a documentação da etapa relacionada.
2. Escrever teste primeiro (Vitest, `src/**/__tests__/*.test.ts`).
3. Implementar em `domain → application → infrastructure`.
4. Rodar `bunx tsgo --noEmit` + `bunx vitest run`.
5. Atualizar `mem://index.md` se a regra for de longa duração.

## Criando um novo módulo fiscal (plugin)
Consulte [`../../../src/modules/fiscal/platform/template/README.md`](../../../src/modules/fiscal/platform/template/README.md).
Passos essenciais:
1. Criar `src/modules/fiscal/<codigo>/` com `domain/`, `application/`, `infrastructure/`, `__tests__/`, `plugin.ts`.
2. Exportar `PluginDocumentoFiscal` via `sdk.definePlugin`.
3. Registrar layouts, serviços, validadores, builders, eventos, workflows.
4. Registrar via `platform.use(plugin)`.
5. Escrever testes de extensibilidade (referência: `platform/__tests__/platform.test.ts`).

## Criando integração
- Todo transporte SEFAZ passa pelo `sefaz-proxy` (nunca direto do navegador ou do módulo).
- Integrações externas: registrar no `IntegracaoRegistry` (Etapa 13) via `IntegracaoAdapter`.

## Revisão de código
- Não repetir código existente — consultar wrappers canônicos (V2, SummaryCard, StatusBadge, AdvancedFilterBar, FormModal).
- Nenhuma regra tributária hard-coded — sempre via `TributoRegistry` + `MotorTributarioAbstrato`.
