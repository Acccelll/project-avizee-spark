## Objetivo

Centralizar os `(supabase as any).from(table)` dinâmicos em `fromUntyped(table)` (wrapper canônico em `src/lib/supabase/fromUntyped.ts`), e habilitar strict-core nos arquivos afetados.

## Mudanças

### 1. `src/hooks/useSupabaseCrud.ts` (5 casts)
- Adicionar `import { fromUntyped } from "@/lib/supabase/fromUntyped";`.
- Substituir todas as 5 ocorrências de `(supabase as any).from(table)` por `fromUntyped(table)`.
- Manter `any` nos builders internos (`buildQuery(): any`, `let query: any`) — aceitável, hook é genérico.
- Adicionar comentário curto: `// fromUntyped aceito: tabela é dinâmica (parâmetro da chamada)`.

### 2. `src/hooks/useTableCount.ts` (1 cast)
- Adicionar import.
- Substituir `(supabase as any).from(table)` por `fromUntyped(table)`. Manter `let q: any` e `eslint-disable` adjacente (builder dinâmico).

### 3. `src/hooks/useFieldUnique.ts` (1 cast)
- Adicionar import.
- Substituir `(supabase as any).from(table)` por `fromUntyped(table)`. Manter `let q: any`.

### 4. `src/services/_shared/safeDelete.ts` (3 casts)
- Adicionar import.
- Substituir os 3 `(supabase as any).from(dep.table | table)` por `fromUntyped(...)` (no `checkDependencies`, no `hardDelete` e no soft delete).

### 5. `tsconfig.strict-core.json`
Acrescentar ao array `include`:
```
"src/services/_shared/**/*",
"src/hooks/useSupabaseCrud.ts",
"src/hooks/useTableCount.ts",
"src/hooks/useFieldUnique.ts"
```

## Validação

`npx tsc -p tsconfig.strict-core.json --noEmit` deve passar limpo. Se aparecer erro estrito pré-existente nesses arquivos (não relacionado ao refactor), aplicar narrow/cast mínimo apenas para destravar — sem alterar lógica.

## Fora de escopo

- Alterar interfaces públicas dos hooks, queryKeys, lógica de filtros, paginação ou UX.
- Tipar `useSupabaseCrud` por tabela (exigiria genérico `T extends TableName`).
