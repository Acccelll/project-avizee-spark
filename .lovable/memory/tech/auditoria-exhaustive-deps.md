---
name: Auditoria exhaustive-deps
description: Todas as 32 supressões de react-hooks/exhaustive-deps são legítimas (URL sync, one-shot migrations, drill-down, drawer fetch com nonce); cada uma documentada inline com justificativa após "--"
type: preference
---
# Auditoria react-hooks/exhaustive-deps

**Estado.** Todas as supressões em `src/` foram revisadas e documentadas com
justificativa inline no formato:

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps -- <razão técnica>
```

## Padrões legítimos de supressão (não bug)

1. **URL sync**: efeitos que chamam `setSearchParams` omitem o setter (estável por
   design do react-router).
2. **One-shot migrations**: hooks como `useDataTablePrefs`, `useDashboardLayout`,
   `useFavoritos` migram dados legados de localStorage → backend uma vez por
   `userId`/`moduleKey`.
3. **Drill-down via query string**: efeitos que reagem a `?atrasadas=1`,
   `?critico=1`, `?new=1` rodam só quando `searchParams` muda; setters do
   useState são estáveis.
4. **Drawer/fetch on key change**: usam `nonce` como gatilho explícito de reload
   para evitar refetch automático em cada mudança de referência.
5. **Form load (`OrcamentoForm`, `*Tab`)**: `loadData()`/`load()` capturam
   dependências via closure; recriar a função a cada render dispararia refetch
   em loop.
6. **Memo init**: `useMemo(() => ..., [])` para snapshot de schema/seed inicial.

## Regra para novas supressões

Sempre incluir comentário no formato `-- razão` para revisor entender em 5s
por que a regra está sendo desativada. Se não conseguir explicar, é bug —
remova a supressão e corrija.
