## Resultado da nova verificação (acabei de rodar)

| Ambiente | Worker HTTP | SEFAZ HTTP | Diagnóstico |
|---|---|---|---|
| **1 — Produção (`www1`)** | 200 OK | **520** `error code: 520` | Cloudflare **ainda** não consegue abrir TLS com a origem. Binding mTLS continua sem cobrir `www1.nfe.fazenda.gov.br` (ou cert A1 ausente/expirado nesse binding). |
| **2 — Homologação (`hom1`)** | 200 OK | 500 (SOAP Fault válido) | mTLS funcionando. O 500 é instabilidade momentânea do BIG-IP do AN, não é problema de transporte. |

**Veredito: nada mudou desde o último ping.** A correção precisa ser feita no painel do Cloudflare — não há nada para alterar no código do app (Worker e edge function estão corretos).

## O que precisa ser feito no Cloudflare (fora do Lovable)

1. Cloudflare Dashboard → **SSL/TLS → Client Certificates** (ou **Workers & Pages → sefaz-mtls-proxy → Settings → Variables and Secrets → mTLS Certificates**).
2. Abrir o certificado A1 ligado ao binding `SEFAZ_CERT`.
3. No campo **Hostnames** / `allowed_hosts`, adicionar **exatamente**: `www1.nfe.fazenda.gov.br` (manter `hom1.nfe.fazenda.gov.br` que já está lá).
4. Salvar.
5. Confirmar no `wrangler.toml` (ou na aba Bindings do Worker) que o `[[mtls_certificates]]` referenciado tem `binding = "SEFAZ_CERT"` e o `certificate_id` aponta para o cert acima.
6. Redeployar o Worker (`wrangler deploy` ou botão Deploy no painel).
7. Me avisar para eu rodar `worker-ping ambiente=1` de novo — deve voltar SOAP Fault ou 200 (não mais `error code: 520`).

## Alternativa de diagnóstico (se você jurar que o hostname já está no binding)

Se já estiver lá e mesmo assim devolver 520, as causas possíveis em ordem:

- **Cert A1 expirado** no Cloudflare (validade venceu). Verifique a data no painel.
- **Cert A1 substituído** sem reupload (você renovou local mas não no Cloudflare).
- **Binding name divergente** — o Worker lê `env.SEFAZ_CERT`; se o `[[mtls_certificates]]` estiver com `binding = "SEFAZ_MTLS"` ou outro nome, `env.SEFAZ_CERT` é `undefined` e o `fetch` cai no `catch` (mas aí o body não seria `"error code: 520"` — seria o JSON com `error` do catch; então essa hipótese é menos provável dado o body atual).

## Plano de ação no app

Nenhum. Não há mudança de código a fazer agora. Aguardar você ajustar o binding/cert no Cloudflare e então re-rodar o ping para confirmar.
