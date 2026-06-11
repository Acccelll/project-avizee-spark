---
name: Transporte mTLS SEFAZ
description: Deno/rustls NÃO consegue falar com o Ambiente Nacional (www1.nfe.fazenda.gov.br) — IIS exige renegociação TLS, não suportada por rustls. Transporte obrigatório via proxy externo (Cloudflare Worker mTLS)
type: constraint
---

# Transporte mTLS contra a SEFAZ AN

`Deno.createHttpClient({ cert, key })` direto contra `www1.nfe.fazenda.gov.br`
SEMPRE falha com `Connection reset by peer (os error 104)`.

**Why:** o IIS/Schannel da SEFAZ solicita **renegociação TLS** após o request
para pedir o certificado de cliente. rustls (stack TLS do Deno) não suporta
renegociação por design (denoland/deno#32245, rustls non-features). Não há
flag/workaround no runtime — não tentar de novo "consertar" o cliente Deno.

**Como resolver:** transporte via proxy com stack OpenSSL/Schannel
(ex.: Cloudflare Worker com `mtls_certificate` binding). O binding do Worker
precisa cobrir o hostname de PRODUÇÃO `www1.nfe.fazenda.gov.br` (não só hom1),
senão o Worker devolve HTTP 520. Secrets: `SEFAZ_USE_MTLS_PROXY`,
`SEFAZ_MTLS_PROXY_URL`, `SEFAZ_MTLS_PROXY_SECRET`.