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

**Contrato do Worker:** devolve JSON `{"success":bool,"status":n,"body":"<xml>"}`
— o sefaz-distdfe desembrulha `body` quando `success:true`.

**Intermitência:** o BIG-IP do AN devolve 520/500-vazio esporádicos para a
MESMA requisição que passa segundos depois. O sefaz-distdfe faz até 4
tentativas (soap12/soap11 alternados) com backoff de 1,5s. `worker-ping`
aceita `corpo`/`contentType`/`soapaction` para diagnóstico do transporte.

**Cuidado com cStat 656:** consultar com ultNSU=0 repetidamente bloqueia o
CNPJ por 1h ("Consumo Indevido"). Sempre reutilizar o ultNSU retornado.