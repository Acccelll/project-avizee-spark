# Plano incremental de endurecimento TypeScript

## Objetivo
Evoluir a segurança de tipos sem Big Bang, reduzindo regressões nos módulos críticos e mantendo o projeto estável.

## Etapa atual (concluída neste patch)
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
