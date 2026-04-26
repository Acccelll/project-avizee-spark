---
name: Tipagem RPC Centralizada
description: src/types/rpc.ts oferece RpcName, RpcArgs<N>, RpcReturn<N> e invokeRpc tipado para chamar funções PostgREST sem `as any`
type: preference
---
# Tipagem centralizada de RPCs

Use `src/types/rpc.ts` ao invés de redeclarar tipos de retorno em cada hook.

- `RpcName` — union de todos os nomes de função pública (do `types.ts` gerado).
- `RpcArgs<N>` / `RpcReturn<N>` — tipos derivados por nome.
- `invokeRpc(name, args)` — wrapper que devolve o payload já tipado e
  lança `Error(error.message)` em falha do PostgREST.

**Quando usar `invokeRpc` vs. `supabase.rpc` direto:**
- `invokeRpc` em hooks novos / refactors (ergonomia + tipagem).
- `supabase.rpc` direto continua válido quando você precisa de
  `.single()` ou de tratamento granular do `error` (ex.: 23505 unique violation).

**Não** redeclarar interfaces de retorno se elas já existem em `Database["public"]["Functions"]`. Se faltar tipagem, é porque a RPC não foi
criada via migration — corrija o schema, não o código.

**Why:** elimina `as any` em ~40 callers de RPC e protege contra drift de
schema (PGRST204) que apareceu em ondas anteriores.

**How to apply:**
```ts
import { invokeRpc } from "@/types/rpc";
const numero = await invokeRpc("proximo_numero_orcamento", {});
```