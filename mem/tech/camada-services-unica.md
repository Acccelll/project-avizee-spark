---
name: Camada services como única autoridade de dados
description: Acesso a `supabase.from/rpc/storage` proibido fora de src/services/, src/lib/realtime/* (canais singleton) e src/types/rpc.ts (helper callRpc)
type: constraint
---

Após a Onda 6 de migração, **toda** chamada a `supabase.from(...)`, `supabase.rpc(...)` e `supabase.storage.*` deve viver em `src/services/`. Pages, components, hooks, contexts e lib consomem apenas funções de service.

**Exceções legítimas (não migrar):**
- `src/lib/realtime/*` — canais realtime singleton (`subscribeAlerts`, `subscribeComercial`).
- `src/types/rpc.ts` — helper genérico `callRpc` tipado.
- `supabase.auth.*` — SDK de auth em pages/components de Login/Signup/Reset/Confirm/SessionExpiryWarning.
- `supabase.functions.invoke` — transporte para edge functions (já encapsulado em hooks dedicados como `useSessoes`, `useSessoesMetricas`, `_shared.ts` de admin).

**Como aplicar:**
- Antes de adicionar `supabase.from/rpc/storage` em qualquer arquivo fora de `src/services/`, crie/estenda o service correspondente.
- Se faltar service para o domínio, criar `src/services/<dominio>.service.ts` ou `src/services/<dominio>/<arquivo>.ts`.
- Manter funções tipadas (sem `as any` exceto para views `vw_*` ainda não tipadas no schema).

**Por quê:** centraliza I/O, facilita teste, evita drift de tipos, permite swap futuro de cliente sem refazer UI.
