---
name: Edge Rate Limit
description: Helper supabase/functions/_shared/rate-limit.ts (em memória) para funções que consomem APIs pagas
type: feature
---
# Rate limit em Edge Functions

- Helper: `supabase/functions/_shared/rate-limit.ts` (`checkRateLimit`, `rateLimitKey`, `rateLimitResponse`).
- Memória por instância (não distribuído); cobre loops de UI e abuso individual.
- Aplicado: `ia-extracao-documento` 20/min, `ia-sugestao` 60/min, `consultadanfe-proxy` 30/min (auth obrigatória adicionada aqui), `social-sync` 10/min.
