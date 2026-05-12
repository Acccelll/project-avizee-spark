---
name: Edge Functions Shared Helpers
description: Helpers compartilhados em supabase/functions/_shared/ (pfx, c14n, cors, logger, permissions)
type: reference
---
Helpers em `supabase/functions/_shared/`:
- `pfx.ts` — `pfxToPem` (cert+chave+cnpj com cadeia leaf+intermediários), `extrairChaveECertificado` ({privateKey, cert} com leaf-detection), `parseCertificado` (CertificadoInfo). Usado por sefaz-proxy e sefaz-distdfe.
- `xml-c14n.ts` — C14N exclusivo (gated por SEFAZ_C14N_REAL=true em sefaz-proxy).
- `cors.ts` — `buildCorsHeaders` com ALLOWED_ORIGIN.
- `logger.ts` — logging estruturado.
- `permissions.ts` — `requireAnyPermission`, `hasAnyPermission`.
- `sanitize.ts`, `email-templates/`, `transactional-email-templates/`.

Regra: nova lógica usada por 2+ functions deve ser extraída para `_shared/`.
