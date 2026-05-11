## Ajuste 1 — `src/contexts/AuthContext.tsx`

Linha 22:
```diff
-const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;
+const AUTH_BOOTSTRAP_TIMEOUT_MS = 15_000;
```
Atualizar também o comentário acima da constante (se houver) para refletir o novo valor; sem outras mudanças.

## Ajuste 2 — `vite.config.ts` (workbox.runtimeCaching)

Bloco `supabase-listas` (linhas 105-118): ampliar regex e bumpar `maxEntries`. Handler/cacheName/maxAgeSeconds preservados.

```diff
-            urlPattern: ({ url, request }) =>
-              request.method === "GET" &&
-              /\/rest\/v1\/(clientes|fornecedores|produtos|app_configuracoes)/.test(url.pathname),
+            urlPattern: ({ url, request }) =>
+              request.method === "GET" &&
+              /\/rest\/v1\/(clientes|fornecedores|produtos|app_configuracoes|grupos_economicos|transportadoras|formas_pagamento|contas_bancarias)/.test(url.pathname),
             handler: "StaleWhileRevalidate",
             options: {
               cacheName: "supabase-listas",
-              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
+              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 5 },
               cacheableResponse: { statuses: [200] },
             },
```

## Validação

- `tsc -p tsconfig.strict-core.json --noEmit` (esperado: nenhum erro novo).
- Sem QA visual necessário — alterações puramente de configuração.

Sem outras mudanças.