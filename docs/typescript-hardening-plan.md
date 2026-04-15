# Plano incremental de endurecimento TypeScript

## Objetivo
Evoluir a segurança de tipos sem Big Bang, reduzindo regressões nos módulos críticos e mantendo o projeto estável.

## Etapa atual (concluída em 15/04/2026)
- Remoção de `@ts-nocheck` em arquivos prioritários:
  - `src/pages/Perfil.tsx`
  - `src/services/admin/empresa.service.ts`
- Remoção adicional em hooks pequenos e de alto uso em relatórios:
  - `src/pages/relatorios/hooks/useRelatorioVendas.ts`
  - `src/pages/relatorios/hooks/useRelatorioFinanceiro.ts`
- Redução de `any` e tipagem explícita de:
  - estados de página;
  - payloads de serviço;
  - retornos de Supabase;
  - handlers de formulário.

## Rodada corretiva adicional (dashboard + financeiro)
- Dashboard:
  - remoção de `any[]` em `recentOrcamentos`, `backlogOVs` e `comprasAguardando`;
  - criação de aliases tipados no core dos hooks (`RecentOrcamento`, `BacklogOv`, `CompraAguardando`);
  - alinhamento ponta a ponta entre `useDashboardData`, `useDashboardComercialData` e `useDashboardAuxData`.
- Financeiro:
  - tipagem dos contratos de `create`/`update` em `useFinanceiroActions` com `Partial<Lancamento>`;
  - remoção de casts `as any` residuais no fluxo do drawer da página Financeiro;
  - reforço de tipagem nas colunas com `satisfies Column<Lancamento>[]`;
  - atualização tipada de campos no formulário com helper genérico por chave.
- Performance/legibilidade:
  - redução de dependências amplas de `useMemo` em hooks de Dashboard (`useDashboardDrawerData`, `useDashboardKpis`).

## Escopo atual do `typecheck:core`
Além dos arquivos já existentes, o `tsconfig.strict-core.json` agora inclui:
- Dashboard
  - `src/pages/dashboard/hooks/types.ts`
  - `src/pages/dashboard/hooks/useDashboardData.ts`
  - `src/pages/dashboard/hooks/useDashboardComercialData.ts`
  - `src/pages/dashboard/hooks/useDashboardAuxData.ts`
  - `src/pages/dashboard/hooks/useDashboardDrawerData.ts`
  - `src/pages/dashboard/hooks/useDashboardKpis.ts`
- Financeiro
  - `src/pages/financeiro/types.ts`
  - `src/pages/financeiro/hooks/useFinanceiroActions.ts`
  - `src/pages/financeiro/hooks/useFinanceiroFiltros.ts`
  - `src/pages/financeiro/components/FinanceiroLancamentoForm.tsx`
  - `src/pages/financeiro/config/financeiroColumns.tsx`

> Decisão explícita: `tsconfig.json` e `tsconfig.app.json` globais **não** foram endurecidos nesta rodada, para manter rollout incremental sem Big Bang.

## Pendências mapeadas para próximas ondas
- Persistem casts localizados em serviços legados (principalmente integrações Supabase com payload dinâmico).
- Alguns módulos grandes fora do núcleo estrito ainda exigem saneamento prévio antes de entrar no `typecheck:core`.
- Próxima etapa deve continuar removendo `@ts-nocheck` somente onde houver contrato de tipo sustentável sem cast artificial.

## Estratégia adotada
1. **Priorizar superfícies core** (perfil/admin/serviços) onde erro de tipo impacta operação.
2. **Eliminar `@ts-nocheck` por arquivo**, garantindo tipagem local antes de avançar.
3. **Usar tipos gerados do Supabase** como fonte primária para payloads e retornos.
4. **Evitar cast amplo**; permitir narrowings pontuais apenas quando o tipo JSON exigir validação de runtime.
5. **Expandir em ondas curtas** (5–10 arquivos por PR), com foco em risco/valor.

## Próximas etapas (curto prazo)
1. Remover `@ts-nocheck` de serviços core restantes:
   - `src/services/freteSimulacao.service.ts`
   - `src/services/social.service.ts`
2. Remover `@ts-nocheck` de páginas de operação diária:
   - `src/pages/Logistica.tsx`
   - `src/pages/Fiscal.tsx`
   - `src/pages/Social.tsx`
3. Criar uma verificação de tipagem estrita por escopo (tsconfig dedicado) para os módulos já saneados.
4. Após 2–3 ondas estáveis, considerar elevar `strictNullChecks` em subárvores controladas.

## Critério para subir rigidez global
Somente após:
- redução significativa de `@ts-nocheck` nas áreas core;
- estabilidade de CI em ondas incrementais;
- cobertura de testes mínima nos fluxos mais sensíveis.
