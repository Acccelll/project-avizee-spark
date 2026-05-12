---
name: Edge Functions CORS infra
description: Shared CORS helper supabase/functions/_shared/cors.ts; ALLOWED_ORIGIN env appends extra origins
type: feature
---

All browser-callable edge functions MUST import CORS headers from `supabase/functions/_shared/cors.ts`:

```ts
import { buildCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = buildCorsHeaders(null);

Deno.serve(async (req) => {
  corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // ...
});
```

Module-level `let` é reatribuído por request para preservar helpers (`json()`, `jsonRes()`, `jsonResponse()`) que referenciam `corsHeaders` fora do `Deno.serve`. Concorrência: dentro de um isolate Deno os handlers são entrelaçados; cabeçalhos resultantes podem refletir origin de outra request concorrente. Aceitável porque (a) ALLOW_ORIGIN é estritamente allow-listed via `isOriginAllowed()` e (b) JWT/role gate sempre é a defesa primária.

Allow-list (always): localhost, 127.0.0.1, *.lovableproject.com, *.lovable.app, *.lovable.dev, https://sistema.avizee.com.br.
`ALLOWED_ORIGIN` env var (comma-separated) appends extra origins.

Echoes the request `Origin` only when allow-listed; otherwise falls back to `*`. Adds `Vary: Origin`.

Default `Access-Control-Allow-Headers` already includes Supabase client headers. Default `Methods`: `POST, OPTIONS` (override via opts).

**Coverage (após onda TIER 1+2 de 12/mai/2026):** admin-users, admin-sessions, social-sync, sefaz-proxy, sefaz-distdfe, correios-api, validate-invite, consultadanfe-proxy, instagram-oauth, notify-orcamento-resposta, preview-transactional-email, handle-email-unsubscribe, send-transactional-email, apresentacao-cadencia-runner. Funções server-to-server (cron, webhooks, auth-email-hook, process-email-queue, notify-admin-new-signup, handle-email-suppression, test-smtp) não precisam — não são chamadas do browser.
